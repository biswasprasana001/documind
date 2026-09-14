import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const API_URL = "http://localhost:8000";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setUploadStatus(data.message || "Upload successful!");
      } else {
        setUploadStatus(`Error: ${data.detail || 'Upload failed'}`);
      }
    } catch (error) {
      setUploadStatus(`Error: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsAsking(true);
    setAnswer("Thinking...");

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      if (response.ok) {
        setAnswer(data.answer);
      } else {
        setAnswer(`Error: ${data.detail || 'Failed to get answer'}`);
      }
    } catch (error) {
      setAnswer(`Error: ${error}`);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="min-h-screen p-8 md:p-16 max-w-4xl mx-auto space-y-12">
      <header className="brutal-card bg-brutal-secondary">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
          Document Q&A AI
        </h1>
        <p className="mt-2 font-medium">
          Upload your PDF or TXT files and ask questions to get AI-generated answers based strictly on the document context.
        </p>
      </header>

      <section className="brutal-card space-y-4">
        <h2 className="text-2xl font-bold">1. Upload Document</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <input 
            type="file" 
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="brutal-input w-full sm:w-auto flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-brutal-yellow file:text-black hover:file:bg-brutal-primary"
          />
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="brutal-btn whitespace-nowrap"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {uploadStatus && (
          <p className="text-sm font-bold p-2 bg-brutal-bg border-l-4 border-black">
            {uploadStatus}
          </p>
        )}
      </section>

      <section className="brutal-card space-y-4 bg-brutal-yellow">
        <h2 className="text-2xl font-bold">2. Ask Questions</h2>
        <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is the main topic of the document?"
            className="brutal-input flex-1"
          />
          <button 
            type="submit"
            disabled={isAsking}
            className="brutal-btn"
          >
            {isAsking ? 'Asking...' : 'Ask AI'}
          </button>
        </form>
        
        {answer && (
          <div className="mt-6 p-4 border-2 border-black bg-white shadow-brutal-sm">
            <h3 className="font-bold border-b-2 border-black pb-2 mb-2 uppercase">AI Response</h3>
            <div className="prose prose-sm md:prose-base prose-p:font-medium text-black">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </div>
        )}
      </section>
      
      <footer className="text-center font-bold text-sm">
        Built with FastAPI, React, Tailwind CSS, pgvector, and Google Gemini API.
      </footer>
    </div>
  );
}

export default App;
