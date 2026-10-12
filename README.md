# 🧠 DocuMind — Document Q&A AI

<p align="center">
  <strong>A full-stack, multi-document Retrieval-Augmented Generation (RAG) platform powered by Google Gemini, Fastembed local embeddings, PostgreSQL with pgvector, and FastAPI with a bold Neo-Brutalist React UI.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black&style=for-the-badge" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white&style=for-the-badge" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?logo=postgresql&logoColor=white&style=for-the-badge" alt="PostgreSQL pgvector" />
  <img src="https://img.shields.io/badge/Google%20Gemini-3.6%20Flash-4285F4?logo=google&logoColor=white&style=for-the-badge" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/Fastembed-Local%20MiniLM--L6--v2-FF6F00?logo=python&logoColor=white&style=for-the-badge" alt="Fastembed Local" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwindcss&logoColor=white&style=for-the-badge" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Docker-Compose_Ready-2496ED?logo=docker&logoColor=white&style=for-the-badge" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License MIT" />
</p>

---

## 📽️ Project Walkthrough & Demo

<div align="center">

<p align="center">

### 🌟 Walkthrough
https://github.com/user-attachments/assets/a52b5c47-7027-4199-874a-4ffed19f144b

</p>

</div>

---

## ✨ Features

- **📑 Multi-Document Ingestion (`.pdf` & `.txt`)**:
  - High-performance text parsing powered by **PyMuPDF** (`fitz`).
  - Intelligent chunking via LangChain's **RecursiveCharacterTextSplitter** (1,000-character windows with 200-character overlap).
  - Built-in guardrails: 5MB maximum file size and 100-chunk threshold per document to prevent context abuse.

- **⚡ 100% Free Local Embeddings & Vector Search**:
  - Generates dense 384-dimensional vector representations locally using **Fastembed** (`sentence-transformers/all-MiniLM-L6-v2`) via ONNX Runtime — **$0 cost and zero external embedding API limits**.
  - Stored and indexed in **PostgreSQL 16** with native **`pgvector`** vector search using cosine distance (`<=>`).
  - Top-8 most relevant chunks retrieved across all uploaded documents in the active session.

- **🤖 Cross-Document Synthesis with Google Gemini**:
  - Direct integration with **Gemini 3.6 Flash** for near-instant answers.
  - Cross-references answers across multiple uploaded documents and cites source filenames.
  - Responses rendered beautifully with markdown styling, tables, and code snippets.

- **🔑 Bring Your Own Key (BYOK) with Instant Verification**:
  - Run with server defaults or allow users to supply their personal Google Gemini API key.
  - Key stored client-side in `localStorage` and sent over secure per-request headers (`X-Gemini-API-Key`).
  - In-app **Key Verification Panel** tests credentials against upstream AI endpoints (`/verify-keys`) before saving.

- **🛡️ Intelligent Rate Limiting & User-Friendly Errors**:
  - Tiered rate limits powered by **SlowAPI**: standard users get 15 req/min, BYOK users receive an elevated 100 req/min quota.
  - Automatically parses upstream API `429 Too Many Requests` retry headers into human-readable duration strings.

- **🔒 Ephemeral Privacy & One-Click Workspace Wipe**:
  - Each browser tab generates an isolated UUID session.
  - One-click **"Clear All"** instantly purges all document chunks and embeddings from the vector database for that session.

- **🎨 Striking Neo-Brutalist User Interface**:
  - Styled with **Tailwind CSS v4** featuring high-contrast borders, tactile drop-shadows, responsive badges, and smooth state indicators.

---

## 🏗️ Architecture & RAG Pipeline

```mermaid
flowchart TD
    subgraph Client["Frontend (React 19 + Tailwind CSS v4)"]
        UI["Neo-Brutalist Interface"]
        BYOK["BYOK Key Panel (localStorage)"]
        Session["Session Manager (UUID)"]
    end

    subgraph Backend["FastAPI Backend Service"]
        API["FastAPI App + SlowAPI Limiter"]
        Parser["PyMuPDF (fitz)"]
        Splitter["RecursiveCharacterTextSplitter"]
        Embedder["Fastembed (Local MiniLM-L6-v2)"]
        RAG["RAG Synthesizer"]
    end

    subgraph DB["PostgreSQL 16 + pgvector"]
        VectorDB[("documents Table\nembedding vector(384)\nsession_id index")]
    end

    subgraph AI["External Services"]
        Gemini["Google Gemini 3.6 Flash"]
    end

    %% Ingestion Flow
    UI -->|"1. Upload .pdf / .txt + session_id"| API
    API -->|"2. Extract Text"| Parser
    Parser -->|"3. Chunk Text (1000/200)"| Splitter
    Splitter -->|"4. Generate 384-d Vectors (Local)"| Embedder
    Embedder -->|"5. Batch Insert"| VectorDB

    %% Query Flow
    UI -->|"6. Question + session_id (+ X-Gemini-API-Key)"| API
    API -->|"7. Embed Query (Local)"| Embedder
    Embedder -->|"8. Cosine Similarity (<=>) Top-8"| VectorDB
    VectorDB -->|"9. Matched Chunks + Sources"| RAG
    RAG -->|"10. Prompt + Context Synthesis"| Gemini
    Gemini -->|"11. Grounded Markdown Answer"| RAG
    RAG -->|"12. Formatted Response"| UI
```

---

## 🛠️ Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Modern, type-safe reactive frontend |
| **Build Tool** | [Vite 8](https://vitejs.dev/) | Lightning-fast HMR and production bundling |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Neo-Brutalism design system and responsive styling |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) | Formatted AI output rendering |
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) | High-performance asynchronous Python web framework |
| **Text Extraction** | [PyMuPDF](https://pymupdf.readthedocs.io/) (`fitz`) | Fast PDF & TXT document stream parsing |
| **Text Chunking** | [LangChain Text Splitters](https://python.langchain.com/) | Semantic overlap character chunking (1000/200) |
| **Embeddings** | [Fastembed](https://qdrant.github.io/fastembed/) | Local, zero-cost ONNX inference for `sentence-transformers/all-MiniLM-L6-v2` |
| **LLM Model** | [Google Gemini](https://ai.google.dev/) (`gemini-3.6-flash`) | Multi-document synthesis and question answering |
| **Vector Database** | [PostgreSQL 16](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) | Relational storage & native vector similarity indexing (`vector(384)`) |
| **Rate Limiter** | [SlowAPI](https://github.com/laurentS/slowapi) | In-memory IP and BYOK-aware request rate limiting |
| **Containerization** | [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) | Full container orchestration for DB, backend, and frontend |

---

## 📁 Repository Structure

```text
├── backend/
│   ├── Dockerfile                  # Python 3.12-slim backend container
│   ├── requirements.txt            # Production dependencies (FastAPI, PyMuPDF, fastembed, etc.)
│   ├── main.py                     # API routing, RAG pipeline, DB migrations & BYOK
│   ├── .env.example                # Template for environment variables
│   └── .env                        # Local environment credentials (ignored by git)
│
├── frontend/
│   ├── Dockerfile                  # Multi-stage Node 20 builder & Nginx alpine runner
│   ├── package.json                # React 19, Tailwind v4, Vite configurations
│   ├── index.html                  # HTML5 entrypoint
│   ├── vite.config.ts              # Vite configuration
│   └── src/
│       ├── App.tsx                 # Main Neo-Brutalist application & state logic
│       ├── index.css               # Global stylesheet & Tailwind directives
│       └── main.tsx                # React DOM root mounting
│
├── docker-compose.yml              # Complete multi-service stack orchestration
├── LICENSE                         # MIT License
└── README.md                       # Project documentation
```

---

## 🚀 Quick Start (Docker Compose — Recommended)

The easiest and fastest way to launch the entire stack (Database, Backend, and Frontend) is with Docker Compose.

### 1. Clone the repository
```bash
git clone https://github.com/biswasprasana001/documind.git
cd documind
```

### 2. Configure environment variables
Create a `.env` file inside the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your API key:
```env
# Google Gemini API key (optional if using BYOK in UI)
GEMINI_API_KEY="your_google_gemini_api_key_here"

# Database connection URL for PostgreSQL pgvector
DATABASE_URL="postgresql://postgres:postgres@db:5432/doc_qa"
```

> **Note**: Even if you leave `GEMINI_API_KEY` blank, you can launch the app and supply your personal key directly in the frontend UI via the **BYOK panel**! Embeddings run locally via Fastembed and require no API key.

### 3. Spin up the application
```bash
docker-compose up --build
```

### 4. Access the apps
- 🌐 **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- 🔌 **Backend API / Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 🗄️ **PostgreSQL / pgvector**: `localhost:5432`

---

## 💻 Manual Local Development Setup

If you prefer running services outside Docker for active development, follow these steps:

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** & `npm` installed
- **PostgreSQL 16+** with the **`pgvector`** extension installed and running

---

### Step 1: Database Setup
Make sure PostgreSQL is running and has the `vector` extension enabled:
```sql
CREATE DATABASE doc_qa;
\c doc_qa
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### Step 2: Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows (PowerShell):
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit .env with your credentials and local DATABASE_URL:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/doc_qa"

# Run backend development server
uvicorn main:app --reload --port 8000
```

---

### Step 3: Frontend Setup
In a separate terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Environment Variables

The backend uses the following environment variables (defined in `backend/.env`):

| Variable | Required? | Description |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | Optional* | Google AI Studio key for `gemini-3.6-flash`. *(Optional if using BYOK in UI)* |
| `DATABASE_URL` | **Yes** | Connection string for PostgreSQL (e.g. `postgresql://postgres:postgres@db:5432/doc_qa`) |

> 🔑 **Obtaining API Keys**:
> - Get a **Google Gemini API Key**: [Google AI Studio](https://aistudio.google.com/app/apikey)
> - **Embeddings**: Handled locally via **Fastembed** with the `sentence-transformers/all-MiniLM-L6-v2` model. **No additional API key is required.**

---

## 📡 API Reference

The backend exposes interactive Swagger documentation at `http://localhost:8000/docs`.

### Core Endpoints

| Method | Endpoint | Description | Key Headers / Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/upload` | Upload & chunk a `.pdf` or `.txt` file, generate local embeddings, and index into pgvector. | `multipart/form-data`: `file`, `session_id` |
| `POST` | `/ask` | Perform semantic vector search (`<=>`) and synthesize answer with Gemini 3.6 Flash. | `JSON`: `{"question": "...", "session_id": "..."}` |
| `GET` | `/documents` | List all unique filenames associated with the active session. | Query Param: `?session_id=<uuid>` |
| `POST` | `/clear` | Delete all indexed chunks, documents, and vectors for a given session. | `JSON`: `{"session_id": "..."}` |
| `POST` | `/verify-keys` | Test the validity of user-provided Gemini API key in real-time. | `JSON`: `{"gemini_key": "..."}` |
| `GET` | `/health` | Healthcheck endpoint returning server status (`{"status": "ok"}`). | None |

### Custom Headers for BYOK
When making requests from custom clients, you can pass:
- `X-Gemini-API-Key: <your_gemini_api_key>`

---

## 🔑 Bring Your Own Key (BYOK) Architecture

This project is built to be zero-cost for self-hosters and flexible for community deployments:
1. Users click the **"🔑 API Keys"** button in the top navigation.
2. Enter their personal Google Gemini API key.
3. Click **"Verify Key"** — the server tests the key in real-time against `gemini-3.6-flash`.
4. Click **"Save Key"** — credentials are held strictly in the user's browser `localStorage` and sent over per-request headers (`X-Gemini-API-Key`).
5. **Elevated Rate Limit**: Requests carrying personal keys bypass default shared limits and receive **100 requests/minute** (vs. 15 requests/minute for standard sessions).

---

## 🤝 Contributing

Contributions make the open-source community an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**!

1. **Fork the Project**
2. **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the Branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Running Linters
```bash
# Frontend linting
cd frontend && npm run lint
```

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](https://github.com/biswasprasana001/documind/blob/main/LICENSE) for more information.

---

<p align="center">
  Built with ❤️ for the Open Source Community.
</p>
