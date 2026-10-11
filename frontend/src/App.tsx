import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const API_URL = "http://localhost:8000";

const LS_GEMINI_KEY = "byok_gemini_key";
const LS_HF_KEY = "byok_hf_key";

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};



// ─────────────────────────────────────────────────────────────
//  Main App
// ─────────────────────────────────────────────────────────────

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

  // ── BYOK state ──────────────────────────────────────────────
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [geminiKey, setGeminiKey]   = useState('');
  const [savedGeminiKey, setSavedGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey]   = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    gemini?: { ok: boolean | null; message: string };
  } | null>(null);

  const isByokActive = !!savedGeminiKey;

  // Load saved key from localStorage on mount (also clear obsolete HF key if present)
  useEffect(() => {
    const g = localStorage.getItem(LS_GEMINI_KEY) || '';
    setSavedGeminiKey(g);
    setGeminiKey(g);
    localStorage.removeItem(LS_HF_KEY);
  }, []);

  // Build per-request BYOK headers
  const byokHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (savedGeminiKey) headers['X-Gemini-API-Key'] = savedGeminiKey;
    return headers;
  };

  // ── Key panel actions ────────────────────────────────────────
  const handleVerifyKeys = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`${API_URL}/verify-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_key: geminiKey }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ gemini: { ok: false, message: `Network error: ${err}` } });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveKeys = () => {
    localStorage.setItem(LS_GEMINI_KEY, geminiKey);
    setSavedGeminiKey(geminiKey);
    setVerifyResult(null);
  };

  const handleClearKeys = () => {
    localStorage.removeItem(LS_GEMINI_KEY);
    localStorage.removeItem(LS_HF_KEY);
    setSavedGeminiKey('');
    setGeminiKey('');
    setVerifyResult(null);
  };

  // ── File handlers ────────────────────────────────────────────
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
        headers: byokHeaders(),   // ← BYOK headers
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
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
          ...byokHeaders(),        // ← BYOK headers
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
      await fetch(`${API_URL}/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (error) {
      console.error("Error clearing session:", error);
    } finally {
      setSessionId(generateSessionId());
      setUploadedDocs([]);
      setFile(null);
      setQuestion('');
      setAnswer('');
      setUploadStatus('Started a new chat session. All previous documents cleared.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsClearing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-8 md:px-10 md:py-12 max-w-4xl mx-auto space-y-5 sm:space-y-8">

      {/* ── Header ── */}
      <header className="brutal-card bg-brutal-secondary flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-tight">
            Upload, Ask, Chat!
          </h1>
          <p className="text-xs sm:text-sm md:text-base font-medium text-gray-800">
            Upload multiple PDF or TXT files and ask questions to get AI-generated answers combining all documents.
          </p>
        </div>
        <button
          onClick={handleNewChat}
          disabled={isClearing}
          className="brutal-btn bg-white hover:bg-brutal-yellow text-xs sm:text-sm font-black uppercase whitespace-nowrap shadow-brutal flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto self-stretch sm:self-auto"
          title="Clear all documents and start a fresh session"
        >
          {isClearing ? 'Clearing...' : '🔄 New Chat'}
        </button>
      </header>

      {/* ── BYOK API Keys Panel ── */}
      <section className="brutal-card space-y-0 p-0 overflow-hidden">
        {/* Panel toggle header */}
        <button
          id="byok-panel-toggle"
          onClick={() => setShowKeyPanel(!showKeyPanel)}
          className="w-full flex items-center justify-between p-3 sm:p-4 md:p-5 font-black text-xs sm:text-sm uppercase tracking-wider hover:bg-gray-50 transition-colors cursor-pointer gap-2"
          aria-expanded={showKeyPanel}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="whitespace-nowrap flex items-center gap-1.5">
              <span>🔑</span>
              <span>API Keys</span>
            </span>
            {isByokActive ? (
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 bg-green-300 border-2 border-black whitespace-nowrap shadow-brutal-sm">
                BYOK Active
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 bg-gray-200 border-2 border-black whitespace-nowrap shadow-brutal-sm">
                Default Keys
              </span>
            )}
          </div>
          <span className="text-base sm:text-lg flex-shrink-0 font-mono">{showKeyPanel ? '▲' : '▼'}</span>
        </button>

        {/* Collapsible body */}
        {showKeyPanel && (
          <div className="border-t-2 border-black p-3.5 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50">
            <p className="text-xs sm:text-sm font-medium text-gray-700 leading-relaxed">
              Provide your own Google Gemini API key to use your personal quota. Keys are stored only in your browser (localStorage) and sent directly to the backend per request — never persisted on the server.
            </p>

            {/* Fastembed notice */}
            <div className="p-3 bg-amber-100/80 border-2 border-black text-xs font-medium text-amber-950 flex items-start gap-2.5 shadow-brutal-sm">
              <span className="text-base select-none leading-none pt-0.5">⚡</span>
              <span className="leading-snug">
                <strong>Note:</strong> Document embeddings run locally with Fastembed for free. No Hugging Face key is required!
              </span>
            </div>

            {/* Key input with integrated toggle */}
            <div className="space-y-1.5">
              <label htmlFor="gemini-key-input" className="block text-xs font-black uppercase tracking-wide">
                Google Gemini API Key
              </label>
              <div className="relative flex items-center w-full">
                <input
                  id="gemini-key-input"
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => { setGeminiKey(e.target.value); setVerifyResult(null); }}
                  placeholder="AQ.Ab8RN6I..."
                  className="brutal-input w-full pr-12 text-xs sm:text-sm font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2 px-2 py-1 text-xs font-bold bg-white border border-black hover:bg-gray-100 transition-colors cursor-pointer select-none"
                  title={showGeminiKey ? 'Hide' : 'Show'}
                  aria-label={showGeminiKey ? 'Hide key' : 'Show key'}
                >
                  {showGeminiKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Verify result messages */}
            {verifyResult && verifyResult.gemini && (
              <div className="space-y-1">
                <p className={`text-xs sm:text-sm font-semibold p-2.5 border-l-4 border-black break-words ${verifyResult.gemini.ok ? 'bg-green-100' : verifyResult.gemini.ok === false ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <span className="font-black">Gemini:</span> {verifyResult.gemini.message}
                </p>
              </div>
            )}

            {/* Action buttons (responsive 3-column grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-1">
              <button
                id="verify-keys-btn"
                onClick={handleVerifyKeys}
                disabled={isVerifying || !geminiKey.trim()}
                className="brutal-btn text-xs sm:text-sm w-full py-2 sm:py-2.5"
              >
                {isVerifying ? '⏳ Verifying...' : '🔬 Verify Key'}
              </button>
              <button
                id="save-keys-btn"
                onClick={handleSaveKeys}
                disabled={!geminiKey.trim()}
                className="brutal-btn bg-green-300 hover:bg-green-400 text-xs sm:text-sm w-full py-2 sm:py-2.5"
              >
                💾 Save Key
              </button>
              <button
                id="clear-keys-btn"
                onClick={handleClearKeys}
                disabled={!isByokActive && !geminiKey}
                className="brutal-btn bg-red-300 hover:bg-red-400 text-xs sm:text-sm w-full py-2 sm:py-2.5"
              >
                🗑️ Clear Key
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Upload Documents ── */}
      <section className="brutal-card space-y-4">
        <h2 className="text-xl sm:text-2xl font-black uppercase">1. Upload Documents</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="brutal-input w-full flex-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-none file:border-2 file:border-black file:text-xs sm:file:text-sm file:font-black file:bg-brutal-yellow file:text-black hover:file:bg-brutal-primary file:cursor-pointer"
          />
          <button
            onClick={handleUpload}
            disabled={isUploading || !file}
            className="brutal-btn w-full sm:w-auto px-6 whitespace-nowrap self-stretch sm:self-auto"
          >
            {isUploading ? '⏳ Uploading...' : '⬆️ Upload'}
          </button>
        </div>

        {uploadStatus && (
          <p className="text-xs sm:text-sm font-bold p-2.5 bg-brutal-bg border-l-4 border-black break-words">
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border-2 border-black shadow-brutal-sm text-xs sm:text-sm font-bold max-w-full break-all"
                >
                  📄 {docName}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Ask Questions ── */}
      <section className="brutal-card space-y-4 bg-brutal-yellow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl sm:text-2xl font-black uppercase">2. Ask Questions</h2>
          {uploadedDocs.length > 0 && (
            <span className="text-[10px] sm:text-xs font-black uppercase px-2 py-1 bg-white border-2 border-black shadow-brutal-sm self-start sm:self-auto">
              Across {uploadedDocs.length} document{uploadedDocs.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              uploadedDocs.length > 0
                ? "e.g. Compare the main topics across documents..."
                : "Upload at least one document first to ask questions..."
            }
            disabled={uploadedDocs.length === 0}
            className="brutal-input w-full min-w-0 flex-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isAsking || uploadedDocs.length === 0}
            className="brutal-btn w-full sm:w-auto px-6 whitespace-nowrap self-stretch sm:self-auto"
          >
            {isAsking ? '⏳ Asking...' : '💬 Ask AI'}
          </button>
        </form>

        {answer && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-5 border-2 border-black bg-white shadow-brutal-sm overflow-hidden">
            <h3 className="font-black border-b-2 border-black pb-2 mb-3 uppercase text-xs sm:text-sm tracking-wide">
              AI Response
            </h3>
            <div className="prose prose-sm sm:prose-base max-w-none text-black break-words overflow-x-auto">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="text-center font-bold text-xs sm:text-sm text-gray-700 py-4">
        Built with FastAPI, React, Tailwind CSS, pgvector, and Google Gemini API.
      </footer>
    </div>
  );
}

export default App;
