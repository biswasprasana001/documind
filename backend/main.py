import os
import io
import json
import re
import requests
import psycopg2
from psycopg2.extras import execute_values
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter
from google import generativeai as genai
from dotenv import load_dotenv
import time
from huggingface_hub import InferenceClient
from pgvector.psycopg2 import register_vector

load_dotenv()

# ─────────────────────────────────────────────
#  Server-side default AI credentials
# ─────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HF_API_KEY = os.getenv("HF_API_KEY")
DB_URL = os.getenv("DATABASE_URL")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    _default_llm = genai.GenerativeModel('gemini-3.6-flash')
else:
    _default_llm = None

_default_hf_client = InferenceClient(api_key=HF_API_KEY) if HF_API_KEY else None

# ─────────────────────────────────────────────
#  Rate limiter — BYOK users get 100/min,
#  default-key users stay at 15/min
# ─────────────────────────────────────────────
def byok_aware_key(request: Request) -> str:
    """Rate-limit key: BYOK requests get a separate, higher-quota bucket."""
    has_gemini = bool(request.headers.get("X-Gemini-API-Key", "").strip())
    has_hf = bool(request.headers.get("X-HF-API-Key", "").strip())
    ip = get_remote_address(request)
    if has_gemini or has_hf:
        return f"byok:{ip}"
    return ip

limiter = Limiter(key_func=byok_aware_key)
app = FastAPI(title="Document Q&A AI")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
#  Per-request AI client resolver
# ─────────────────────────────────────────────
def get_ai_clients(request: Request):
    """
    Returns (llm_model, hf_client) resolved for this request.
    If BYOK headers are present they take precedence over server defaults.
    """
    user_gemini_key = request.headers.get("X-Gemini-API-Key", "").strip()
    user_hf_key = request.headers.get("X-HF-API-Key", "").strip()

    if user_gemini_key:
        genai.configure(api_key=user_gemini_key)
        llm = genai.GenerativeModel('gemini-3.6-flash')
    else:
        llm = _default_llm

    hf = InferenceClient(api_key=user_hf_key) if user_hf_key else _default_hf_client
    return llm, hf

# ─────────────────────────────────────────────
#  Rate-limit error message helpers
# ─────────────────────────────────────────────
def _format_retry_duration(total_seconds: int) -> str:
    """Convert a number of seconds into a human-readable duration string.
    Only non-zero units are included, e.g. '1 hour 23 minutes 45 seconds'.
    """
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)

    parts = []
    if days:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    if seconds or not parts:  # always show seconds if nothing else is non-zero
        parts.append(f"{seconds} second{'s' if seconds != 1 else ''}")

    return " ".join(parts)

def _gemini_rate_limit_detail(error_msg: str) -> str:
    """Return a user-friendly 429 message for Gemini API errors, with retry time if available."""
    match = re.search(r"Please retry in ([\d\.]+)s", error_msg)
    if match:
        total_seconds = int(round(float(match.group(1))))
        duration = _format_retry_duration(total_seconds)
        return f"Gemini AI is currently too busy or has reached its limit. Please try again in {duration}."
    return "Gemini AI is currently too busy or has reached its limit. Please wait a moment and try again."

def _hf_rate_limit_detail(error_msg: str) -> str:
    """Return a user-friendly 429 message for Hugging Face API errors, with retry time if available."""
    match = (
        re.search(r"Please retry in ([\d\.]+)s", error_msg) or
        re.search(r"retry after (\d+)", error_msg, re.IGNORECASE) or
        re.search(r"(\d+)\s*second", error_msg, re.IGNORECASE)
    )
    if match:
        total_seconds = int(round(float(match.group(1))))
        duration = _format_retry_duration(total_seconds)
        return f"Hugging Face embedding service is too busy or has reached its limit. Please try again in {duration}."
    return "Hugging Face embedding service is too busy or has reached its limit. Please wait a moment and try again."

# ─────────────────────────────────────────────
#  Database helpers
# ─────────────────────────────────────────────
def get_db_connection():
    if not DB_URL:
        raise Exception("DATABASE_URL is not set")
    conn = psycopg2.connect(DB_URL)
    register_vector(conn)
    return conn

def init_db(max_retries=10, delay=2):
    if not DB_URL:
        print("DATABASE_URL is not set")
        return
    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(DB_URL)
            cur = conn.cursor()
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            conn.commit()
            register_vector(conn)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id serial PRIMARY KEY,
                    session_id text,
                    filename text,
                    content text,
                    embedding vector(384)
                );
                ALTER TABLE documents ADD COLUMN IF NOT EXISTS session_id text;
                CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents (session_id);
            """)
            conn.commit()
            cur.close()
            conn.close()
            print("Database initialized successfully.")
            return
        except Exception as e:
            print(f"DB Init Attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(delay)

@app.on_event("startup")
def on_startup():
    init_db()

init_db()

# ─────────────────────────────────────────────
#  Embedding helper (uses per-request hf client)
# ─────────────────────────────────────────────
def get_embeddings(texts: list[str], hf_client) -> list[list[float]]:
    if not hf_client:
        raise Exception("HF_API_KEY is not set and no user key was provided")
    embeddings = hf_client.feature_extraction(texts, model="sentence-transformers/all-MiniLM-L6-v2")
    if hasattr(embeddings, "tolist"):
        res = embeddings.tolist()
    else:
        res = embeddings
    if texts and isinstance(res, list) and res and not isinstance(res[0], list):
        res = [res]
    return res

# ─────────────────────────────────────────────
#  POST /verify-keys  — test user-supplied keys
# ─────────────────────────────────────────────
class VerifyKeysRequest(BaseModel):
    gemini_key: str = ""
    hf_key: str = ""

@app.post("/verify-keys")
async def verify_keys(payload: VerifyKeysRequest):
    result = {}

    # Test Gemini key
    if payload.gemini_key.strip():
        try:
            genai.configure(api_key=payload.gemini_key.strip())
            model = genai.GenerativeModel('gemini-3.6-flash')
            resp = model.generate_content("Reply with the single word OK")
            result["gemini"] = {"ok": True, "message": f"Valid ✅ — model responded: {resp.text.strip()[:40]}"}
        except Exception as e:
            err_str = str(e)
            if "429" in err_str:
                msg = "Quota Exceeded. Please check your plan and billing details."
            elif any(code in err_str for code in ["400", "401", "403", "API_KEY_INVALID"]):
                msg = "Invalid API Key. Please verify your key is correct and active."
            else:
                msg = "An unexpected error occurred during verification."
            result["gemini"] = {"ok": False, "message": f"Invalid ❌ — {msg}"}
    else:
        result["gemini"] = {"ok": None, "message": "No key provided"}

    # Test HuggingFace key
    if payload.hf_key.strip():
        try:
            hf = InferenceClient(api_key=payload.hf_key.strip())
            embeddings = hf.feature_extraction(["test"], model="sentence-transformers/all-MiniLM-L6-v2")
            result["hf"] = {"ok": True, "message": "Valid ✅ — embeddings returned successfully"}
        except Exception as e:
            err_str = str(e)
            if "429" in err_str:
                msg = "Quota Exceeded. Please check your plan and billing details."
            elif any(code in err_str for code in ["400", "401", "403"]):
                msg = "Invalid API Key. Please verify your key is correct and active."
            else:
                msg = "An unexpected error occurred during verification."
            result["hf"] = {"ok": False, "message": f"Invalid ❌ — {msg}"}
    else:
        result["hf"] = {"ok": None, "message": "No key provided"}

    return result

# ─────────────────────────────────────────────
#  POST /upload
# ─────────────────────────────────────────────
@app.post("/upload")
@limiter.limit("100/minute", key_func=lambda request: f"byok:{get_remote_address(request)}" if (request.headers.get("X-Gemini-API-Key") or request.headers.get("X-HF-API-Key")) else get_remote_address(request))
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    if not file.filename.endswith(('.pdf', '.txt')):
        raise HTTPException(status_code=400, detail="Only .pdf and .txt allowed")

    content = ""
    # File size limit (approx 5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    if file.filename.endswith('.pdf'):
        pdf_doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in pdf_doc:
            content += page.get_text()
    else:
        content = file_bytes.decode('utf-8')

    if not content.strip():
        raise HTTPException(status_code=400, detail="Document is empty")

    # Chunk the text
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(content)

    # Check context abuse (max 100 chunks per document)
    if len(chunks) > 100:
        raise HTTPException(status_code=400, detail="Document too large (too many chunks).")

    _, hf_client = get_ai_clients(request)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Batch insert for efficiency
        embeddings = get_embeddings(chunks, hf_client)

        records = [(session_id, file.filename, chunk, embedding) for chunk, embedding in zip(chunks, embeddings)]
        execute_values(cur,
            "INSERT INTO documents (session_id, filename, content, embedding) VALUES %s",
            records
        )
        conn.commit()

        # Fetch all distinct filenames currently in this session
        cur.execute("SELECT DISTINCT filename FROM documents WHERE session_id = %s ORDER BY filename;", (session_id,))
        documents = [r[0] for r in cur.fetchall()]
        cur.close()
        conn.close()

        return {
            "message": f"Successfully processed {len(chunks)} chunks from {file.filename}",
            "filename": file.filename,
            "documents": documents
        }
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Rate limit" in error_msg or "Too Many Requests" in error_msg:
            raise HTTPException(status_code=429, detail=_hf_rate_limit_detail(error_msg))
        raise HTTPException(status_code=500, detail="Something went wrong during upload. Please try again later.")


# ─────────────────────────────────────────────
#  Request models
# ─────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str
    session_id: str

class ClearRequest(BaseModel):
    session_id: str

# ─────────────────────────────────────────────
#  POST /ask
# ─────────────────────────────────────────────
@app.post("/ask")
@limiter.limit("100/minute", key_func=lambda request: f"byok:{get_remote_address(request)}" if (request.headers.get("X-Gemini-API-Key") or request.headers.get("X-HF-API-Key")) else get_remote_address(request))
async def ask_question(request: Request, query: QueryRequest):
    llm_model, hf_client = get_ai_clients(request)

    if not llm_model:
        raise HTTPException(status_code=503, detail="No Gemini API key configured. Please provide your own key in the API Keys panel.")

    # ── Step 1: Embed the query (Hugging Face) ──
    try:
        query_embedding = get_embeddings([query.question], hf_client)[0]
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Rate limit" in error_msg or "Too Many Requests" in error_msg:
            raise HTTPException(status_code=429, detail=_hf_rate_limit_detail(error_msg))
        raise HTTPException(status_code=500, detail="Something went wrong generating embeddings. Please try again later.")

    # ── Step 2: Vector search + Gemini answer generation ──
    try:
        # Search pgvector within this session
        conn = get_db_connection()
        cur = conn.cursor()

        # Get top 8 most similar chunks across all documents in this session
        cur.execute("""
            SELECT filename, content, 1 - (embedding <=> %s::vector) as similarity
            FROM documents
            WHERE session_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT 8;
        """, (json.dumps(query_embedding), query.session_id, json.dumps(query_embedding)))

        results = cur.fetchall()
        cur.close()
        conn.close()

        if not results:
            return {"answer": "No relevant documents found for this session. Please upload one or more documents first."}

        context = "\n\n".join([f"--- Document: {r[0]} ---\n{r[1]}" for r in results])

        # Use Gemini to generate answer
        prompt = f"""You are a helpful assistant. Use the following context from uploaded document(s) to answer the question. 
If the answer spans or is found across multiple documents, combine and synthesize the information from all relevant documents.
Cite or mention the source document name(s) when helpful.
If the answer is not in the context, say "I don't know based on the provided documents".

Context:
{context}

Question: {query.question}

Answer in markdown format."""

        response = llm_model.generate_content(prompt)
        return {"answer": response.text, "sources": len(results)}

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "Quota" in error_msg or "ResourceExhausted" in error_msg:
            raise HTTPException(status_code=429, detail=_gemini_rate_limit_detail(error_msg))
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again later.")

# ─────────────────────────────────────────────
#  GET /documents
# ─────────────────────────────────────────────
@app.get("/documents")
def get_documents(session_id: str):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT filename FROM documents WHERE session_id = %s ORDER BY filename;", (session_id,))
        documents = [r[0] for r in cur.fetchall()]
        cur.close()
        conn.close()
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong fetching documents. Please try again later.")

# ─────────────────────────────────────────────
#  POST /clear
# ─────────────────────────────────────────────
@app.post("/clear")
def clear_session(payload: ClearRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM documents WHERE session_id = %s;", (payload.session_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Session cleared completely. No documents or memory retained."}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Something went wrong clearing the session. Please try again later.")

# ─────────────────────────────────────────────
#  GET /health
# ─────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok"}
