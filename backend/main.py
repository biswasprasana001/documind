import os
import io
import json
import requests
import psycopg2
from psycopg2.extras import execute_values
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
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

# Initialize Rate Limiter
limiter = Limiter(key_func=get_remote_address)
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

# AI configurations
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
HF_API_KEY = os.getenv("HF_API_KEY")
DB_URL = os.getenv("DATABASE_URL")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    llm_model = genai.GenerativeModel('gemini-3.6-flash')

hf_client = InferenceClient(api_key=HF_API_KEY) if HF_API_KEY else None

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
                    filename text,
                    content text,
                    embedding vector(384)
                );
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

def get_embeddings(texts: list[str]) -> list[list[float]]:
    if not hf_client:
        raise Exception("HF_API_KEY is not set")
    embeddings = hf_client.feature_extraction(texts, model="sentence-transformers/all-MiniLM-L6-v2")
    if hasattr(embeddings, "tolist"):
        res = embeddings.tolist()
    else:
        res = embeddings
    if texts and isinstance(res, list) and res and not isinstance(res[0], list):
        res = [res]
    return res

@app.post("/upload")
@limiter.limit("5/minute")
async def upload_document(request: Request, file: UploadFile = File(...)):
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

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Batch insert for efficiency
        embeddings = get_embeddings(chunks)
        
        records = [(file.filename, chunk, embedding) for chunk, embedding in zip(chunks, embeddings)]
        execute_values(cur, 
            "INSERT INTO documents (filename, content, embedding) VALUES %s",
            records
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": f"Successfully processed {len(chunks)} chunks from {file.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QueryRequest(BaseModel):
    question: str

@app.post("/ask")
@limiter.limit("10/minute")
async def ask_question(request: Request, query: QueryRequest):
    try:
        # Embed the query
        query_embedding = get_embeddings([query.question])[0]
        
        # Search pgvector
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get top 5 most similar chunks
        cur.execute("""
            SELECT content, 1 - (embedding <=> %s::vector) as similarity
            FROM documents
            ORDER BY embedding <=> %s::vector
            LIMIT 5;
        """, (json.dumps(query_embedding), json.dumps(query_embedding)))
        
        results = cur.fetchall()
        cur.close()
        conn.close()
        
        if not results:
            return {"answer": "No relevant documents found in the database. Please upload a document first."}
            
        context = "\n\n".join([r[0] for r in results])
        
        # Use Gemini to generate answer
        prompt = f"""You are a helpful assistant. Use the following context to answer the question. 
If the answer is not in the context, say "I don't know based on the provided documents".

Context:
{context}

Question: {query.question}

Answer in markdown format."""
        
        response = llm_model.generate_content(prompt)
        return {"answer": response.text, "sources": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}
