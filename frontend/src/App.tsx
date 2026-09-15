import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const API_URL = "http://localhost:8000";

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};

function App() {
  const [sessionId, setSessionId] = useState<string>(generateSessionId);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setUploadStatus(`Uploading and processing "${file.name}"...`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setUploadStatus(data.message || `Uploaded "${file.name}" successfully!`);
        if (data.documents) {
          setUploadedDocs(data.documents);
        } else {
          setUploadedDocs((prev) => Array.from(new Set([...prev, file.name])));
        }
        // Clear file input so the user can immediately select and upload another file
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
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
        body: JSON.stringify({ question, session_id: sessionId }),
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

  const handleNewChat = async () => {
    setIsClearing(true);
    try {
      // Erase all documents and vector embeddings from the server for this session
      await fetch(`${API_URL}/clear`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (error) {
      console.error("Error clearing session:", error);
    } finally {
      // Start a completely new session with no memory of previous chats or files
      setSessionId(generateSessionId());
      setUploadedDocs([]);
      setFile(null);
      setQuestion('');
      setAnswer('');
      setUploadStatus('Started a new chat session. All previous documents cleared.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen p-8 md:p-16 max-w-4xl mx-auto space-y-12">
      <header className="brutal-card bg-brutal-secondary flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
            Document Q&A AI
          </h1>
          <p className="mt-2 font-medium">
            Upload multiple PDF or TXT files and ask questions to get AI-generated answers combining all documents.
          </p>
        </div>
        <button
          onClick={handleNewChat}
          disabled={isClearing}
          className="brutal-btn bg-white hover:bg-brutal-yellow text-sm font-black uppercase whitespace-nowrap shadow-brutal flex items-center gap-2 cursor-pointer"
          title="Clear all documents and start a fresh session"
        >
          {isClearing ? 'Clearing...' : '🔄 New Chat'}
        </button>
      </header>

      <section className="brutal-card space-y-4">
        <h2 className="text-2xl font-bold">1. Upload Documents</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="brutal-input w-full sm:w-auto flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-brutal-yellow file:text-black hover:file:bg-brutal-primary cursor-pointer"
          />
          <button 
            onClick={handleUpload}
            disabled={isUploading || !file}
            className="brutal-btn whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        {uploadStatus && (
          <p className="text-sm font-bold p-2 bg-brutal-bg border-l-4 border-black">
            {uploadStatus}
          </p>
        )}

        {/* Uploaded Documents List */}
        <div className="mt-4 pt-4 border-t-2 border-black space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
            Uploaded Documents in this Session ({uploadedDocs.length}):
          </h3>
          {uploadedDocs.length === 0 ? (
            <p className="text-xs font-semibold text-gray-500 italic">
              No documents uploaded yet. Select a file and click "Upload" to add it to this session.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {uploadedDocs.map((docName, idx) => (
                <span 
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-black shadow-brutal-sm text-xs md:text-sm font-bold"
                >
                  📄 {docName}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="brutal-card space-y-4 bg-brutal-yellow">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">2. Ask Questions</h2>
          {uploadedDocs.length > 0 && (
            <span className="text-xs font-bold px-2 py-1 bg-white border-2 border-black shadow-brutal-sm">
              Across {uploadedDocs.length} document{uploadedDocs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              uploadedDocs.length > 0 
                ? "e.g. Compare the main topics or find information across the documents..." 
                : "Upload at least one document first to ask questions..."
            }
            disabled={uploadedDocs.length === 0}
            className="brutal-input flex-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button 
            type="submit"
            disabled={isAsking || uploadedDocs.length === 0}
            className="brutal-btn disabled:opacity-50 disabled:cursor-not-allowed"
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
