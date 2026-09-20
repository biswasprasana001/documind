# 🧠 Document Q&A AI — Upload, Ask, Chat!

<p align="center">
  <strong>A full-stack, multi-document Retrieval-Augmented Generation (RAG) platform powered by Google Gemini, Hugging Face, PostgreSQL with pgvector, and FastAPI with a bold Neo-Brutalist React UI.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black&style=for-the-badge" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.141-009688?logo=fastapi&logoColor=white&style=for-the-badge" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?logo=postgresql&logoColor=white&style=for-the-badge" alt="PostgreSQL pgvector" />
  <img src="https://img.shields.io/badge/Google%20Gemini-3.6%20Flash-4285F4?logo=google&logoColor=white&style=for-the-badge" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/Hugging%20Face-Embeddings-FFD21E?logo=huggingface&logoColor=black&style=for-the-badge" alt="Hugging Face" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwindcss&logoColor=white&style=for-the-badge" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Docker-Compose_Ready-2496ED?logo=docker&logoColor=white&style=for-the-badge" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License MIT" />
</p>

---

## 📽️ Project Walkthrough & Demo

<!-- ========================================================================= -->
<!-- ADD YOUR DEMO VIDEO OR GIF HERE:                                         -->
<!-- 1. For a GIF: Save your GIF into the `assets/` folder and update below.  -->
<!--    Example: ![App Walkthrough](assets/demo.gif)                          -->
<!-- 2. For a Video: Use GitHub release asset / raw link or HTML5 video tag.  -->
<!-- ========================================================================= -->

<div align="center">

<!-- Replace the placeholder below with your GIF or Video link when ready -->
<p align="center">
  <img src="https://via.placeholder.com/1200x630/18181b/ffffff?text=Document+Q%26A+AI+Walkthrough+Video+%2F+GIF+Coming+Soon" alt="Document Q&A AI Walkthrough Demo" width="100%" />
</p>

</div>

---

## ✨ Features

- **📑 Multi-Document Ingestion (`.pdf` & `.txt`)**:
  - High-performance text parsing powered by **PyMuPDF** (`fitz`).
  - Intelligent chunking via LangChain's **RecursiveCharacterTextSplitter** (1,000-character windows with 200-character overlap).
  - Built-in guardrails: 5MB maximum file size and 100-chunk threshold per document to prevent context abuse.

- **⚡ Cloud Embeddings & High-Speed Vector Retrieval**:
  - Generates dense 384-dimensional vector representations using Hugging Face's `sentence-transformers/all-MiniLM-L6-v2` via the cloud `InferenceClient`.
  - Stored and indexed in **PostgreSQL 16** with native **`pgvector`** vector search using cosine distance (`<=>`).
  - Top-8 most relevant chunks fetched concurrently across all documents in the active session.

- **🤖 Cross-Document Synthesis with Google Gemini**:
  - Direct integration with **Gemini 3.6 Flash** for near-instant answers.
  - Cross-references answers across multiple uploaded documents and cites source filenames.
  - Responses rendered beautifully with markdown styling, tables, and code snippets.

- **🔑 Bring Your Own Key (BYOK) with Instant Verification**:
  - Run with server defaults or allow users to supply their personal Gemini and Hugging Face API keys.
  - Keys stored client-side in `localStorage` and sent over secure per-request headers (`X-Gemini-API-Key`, `X-HF-API-Key`).
  - In-app **Key Verification Panel** tests credentials against upstream AI endpoints before saving.

- **🛡️ Intelligent Rate Limiting & User-Friendly Errors**:
  - Tiered rate limits powered by **SlowAPI**: standard users get 15 req/min, BYOK users receive an elevated 100 req/min quota.
  - Automatically parses upstream API `429 Too Many Requests` retry headers into human-readable duration strings (e.g., *"Please try again in 1 minute 15 seconds"*).

- **🔒 Ephemeral Privacy & One-Click Workspace Wipe**:
  - Each browser tab generates an isolated UUID session.
  - One-click **"Clear All"** instantly purges all document chunks and embeddings from the vector database for that session.

- **🎨 Striking Neo-Brutalist User Interface**:
  - Styled with **Tailwind CSS v4** featuring high-contrast borders, tactile drop-shadows, responsive badges, and smooth state indicators.

---

## 🏗️ Architecture & RAG Pipeline

```mermaid
flowchart TD
    subgraph Client["Frontend (React 19 + Tailwind v4)"]
        UI[User UI / Workspace]
        BYOK[BYOK Key Panel]
        UploadUI[File Uploader PDF/TXT]
        ChatUI[Markdown Chat Interface]
    end

    subgraph Server["FastAPI Backend"]
        Parser[PyMuPDF Text Extractor]
        Splitter[Recursive Character Text Splitter]
        Limiter[SlowAPI Rate Limiter]
        Endpoints["FastAPI Router (/upload, /ask, /verify-keys)"]
    end

    subgraph AI_Services["External AI Services"]
        HF["Hugging Face Inference\n(all-MiniLM-L6-v2)"]
        Gemini["Google Gemini 3.6 Flash"]
    end

    subgraph DB["PostgreSQL 16 + pgvector"]
        VecTable[("documents Table\nsession_id | filename | content | embedding")]
        CosSearch["Cosine Distance Search\n<=> Top 8 Chunks"]
    end

    UploadUI -->|1. Upload File & Session ID| Endpoints
    Endpoints --> Parser --> Splitter
    Splitter -->|2. Batch Chunks| HF
    HF -->|3. 384d Vectors| Endpoints
    Endpoints -->|4. Store Records| VecTable

    ChatUI -->|5. Submit Question| Endpoints
    Endpoints -->|6. Query Embeddings| HF
    HF -->|7. Query Vector| Endpoints
    Endpoints -->|8. Vector Similarity Query| CosSearch
    CosSearch -->|9. Top Context Chunks| Endpoints
    Endpoints -->|10. Context + Question Prompt| Gemini
    Gemini -->|11. Synthesized Markdown Answer| Endpoints
    Endpoints -->|12. Streamed/Returned Response| ChatUI
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
| **Text Extraction** | [PyMuPDF](https://pymupdf.readthedocs.io/) (`fitz`) | Fast PDF document stream parsing |
| **Text Chunking** | [LangChain Text Splitters](https://python.langchain.com/) | Semantic overlap character chunking |
| **Embeddings** | [Hugging Face Inference Hub](https://huggingface.co/) | Cloud inference for `sentence-transformers/all-MiniLM-L6-v2` |
| **LLM Model** | [Google Gemini](https://ai.google.dev/) (`gemini-3.6-flash`) | Multi-document synthesis and question answering |
| **Vector Database** | [PostgreSQL 16](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) | Relational storage & native vector similarity indexing |
| **Rate Limiter** | [SlowAPI](https://github.com/laurentS/slowapi) | In-memory IP and BYOK-aware request rate limiting |
| **Containerization** | [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) | Full container orchestration for DB, backend, and frontend |

---

## 📁 Repository Structure

```text
├── backend/
│   ├── Dockerfile                  # Python 3.12-slim backend container
│   ├── requirements.txt            # Production dependencies (FastAPI, PyMuPDF, etc.)
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
└── README.md                       # Project documentation
```

---

## 🚀 Quick Start (Docker Compose — Recommended)

The easiest and fastest way to launch the entire stack (Database, Backend, and Frontend) is with Docker Compose.

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ai-integration.git
cd ai-integration
```

### 2. Configure environment variables
Create a `.env` file inside the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your API keys:
```env
GEMINI_API_KEY="your_google_gemini_api_key"
HF_API_KEY="your_huggingface_user_access_token"
DATABASE_URL="postgresql://postgres:postgres@db:5432/doc_qa"
```

> **Note**: Even if you leave `GEMINI_API_KEY` or `HF_API_KEY` blank, you can still launch the app and supply your personal keys directly in the frontend UI via the **BYOK panel**!

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
| `HF_API_KEY` | Optional* | Hugging Face access token for feature extraction. *(Optional if using BYOK in UI)* |
| `DATABASE_URL` | **Yes** | Connection string for PostgreSQL (e.g. `postgresql://postgres:postgres@db:5432/doc_qa`) |

> 🔑 **Obtaining API Keys**:
> - Get a **Google Gemini API Key**: [Google AI Studio](https://aistudio.google.com/app/apikey)
> - Get a **Hugging Face Access Token**: [Hugging Face Settings -> Tokens](https://huggingface.co/settings/tokens)

---

## 📡 API Reference

The backend exposes interactive Swagger documentation at `http://localhost:8000/docs`.

### Core Endpoints

| Method | Endpoint | Description | Key Headers / Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/upload` | Upload & chunk a `.pdf` or `.txt` file, extract embeddings, and index into pgvector. | `multipart/form-data`: `file`, `session_id` |
| `POST` | `/ask` | Perform semantic vector search and query Gemini for synthesized answer. | `JSON`: `{"question": "...", "session_id": "..."}` |
| `GET` | `/documents` | List all unique filenames associated with the active session. | Query Param: `?session_id=<uuid>` |
| `POST` | `/clear` | Delete all indexed chunks, documents, and vectors for a given session. | `JSON`: `{"session_id": "..."}` |
| `POST` | `/verify-keys` | Test the validity of user-provided Gemini and Hugging Face API keys. | `JSON`: `{"gemini_key": "...", "hf_key": "..."}` |
| `GET` | `/health` | Healthcheck endpoint returning server status. | None |

### Custom Headers for BYOK
When making requests from custom clients, you can pass:
- `X-Gemini-API-Key: <your_api_key>`
- `X-HF-API-Key: <your_access_token>`

---

## 🔑 Bring Your Own Key (BYOK) Architecture

This project is built to be zero-cost for self-hosters or hosted community deployments:
1. Users click the **"🔑 API Keys"** button in the top navigation.
2. Enter their own Google Gemini and Hugging Face keys.
3. Click **"Verify Keys"** — the server tests both keys in real-time against the upstream models.
4. Click **"Save to Browser"** — credentials are held strictly in the user's browser `localStorage` and sent over per-request headers.
5. **Elevated Rate Limit**: Requests carrying personal keys bypass default shared limits and receive **100 requests/minute**.

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

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the Open Source Community.
</p>
