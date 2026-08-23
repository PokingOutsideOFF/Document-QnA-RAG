# Local RAG Document Q&A

Ask questions about your documents using a fully local AI stack no API keys, no cloud services, no usage costs. Upload PDFs, Word docs, or text files and get streamed answers with inline citations showing exactly which passage supported each claim.

---

## How it works

**RAG (Retrieval-Augmented Generation)** works in two phases:

**Upload phase:**
```
Parse file -> Chunk text -> Embed chunks -> Store in Chroma
```

**Query phase:**
```
Question -> Embed query -> Find top-5 similar chunks -> Build prompt -> Ollama streams answer
```

The embedding model turns text into vectors (lists of numbers that encode meańing). When you ask a question, your question is also turned into a vector, and the database finds the chunks with the most similar vectors. Those chunks are. passed to the language model context - so the model answers only from your documents, not from its training data.

---

## Tech Stack

|Layer | Technology | Why |
|---|---|---|
| LLM | Ollama + llama3.1:8b | Local inference, no API key, GPU-accelerated |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | 90 MB model, fast, GPU support | 
| Vector store | Chroma | Embedded DB, persists to disk, no separate server |
| Backend | FastAPI (Python) | REST + SSE streaming, auto Swagger docs at /docs |
| Frontend | Next. js 14 + Tailwind CSS | App router, TypeScript, streaming chat UI | 
| PDF parsing | PyMuPDF | Fastest Python PDF parser |
| DOCX parsing | python-docx | Native Word document support |

---

## Prerequisites

**Python 3.10+** - check with `python --version'
**Node.js 18+** - check with `node --version` 
**Ollama** - download from [ollama.ai](https://ollama.ai) 
**NVIDIA GPU** (recommended) - check CUDA version with `nvidia-smi 
**~8 GB free disk space** - 4.7 GB for the model, ~90 MB for embeddings, rest for Chroma

> The app works without a GPU but embedding will be significantly slower.

---

## Setup

### Step 1 - Install Ollama and pull the model

Download the installer from [ollama.ai](https://ollama.ai) and run it. Then:
```powershell 
ollama pull llama3.1:8b

# Verify it works
ollama run llama3.1:8b "Say hello in one sentence."
```
You can also install
```powershell
ollama pull llama3.2:3b
ollama pull mistral:7b
```

Ollama installs as a Windows service and shows in the system tray. Keep it running.

---

### Step 2 - Set up the Python backend

Open a terminal in the `backend/` folder:
``` powershell 
# Create and activate virtual environment 
python -m venv venv 
.\venv\Scripts\activate


# Install PyTorch with GPU support FIRST 
# Replace cu121 with your CUDA version (check nvidia-smi -> "CUDA Version")
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install all other dependencies 
pip install -r requirements.txt
```

> **Why PyTorch first?** The correct CUDA version (cu118, cu121, cu124) depends on your GPU driver. Installing it before txt ensures the right GPU build is used.

---

### Step 3 - Start the backend server

```powershell 
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open [http://localhost:8000/docs](http://localhost:8000/docs) to confirm it's running. Test a file upload in the Swagger UI before starting the frontend.

---

### Step 4 - Set up the frontend

Open a **new terminal** (keep the backend running) in the `frontend/` folder:

```powershell 
# Bootstrap Next.js (first time only)
npx create-next-app@14 . --typescript --tailwind --eslint --app --import-alias="@/*"

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Using the App
1. **Upload a document** - drag a PDF, DOCX, or TXT onto the left sidebar, or click to browse 
2. *Wait for indexing** - you'll see a confirmation with how many chunks were indexed 
3. **Ask a question** - type in the chat input and press Enter (Shift+Enter for newline) 
4. **Watch the answer stream** - tokens appear in real time; press Stop to cancel 
5. **Check citations** - numbered source badges appear below the answer; click to see the exact passage and relevance score 
6. **Copy answers** - hover ,any assistant message to reveal a Copy button

Your conversation history is saved automatically and restored when you reopen the app.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ollama: command not found` | Restart the terminal after installing Ollama |
| `torch.cuda.is_available()` returns False | Reinstall torch with the correct CUDA version for your GPU |
| Backend port 8000 in use | Run`uvicorn main:app --port 8001` and update `frontend/.env.local` |
| Slow first upload | sentence-transformers downloads the model (~90 MB) on first use - cached after |
| Answer cutf off mid-sentence | Increase `num_ctx` to `8192` in `backend/services/llm.py` |
| CORS error in browser | Verify backend is on port 8000 and frontend on port 3000 |
| "I don't have enough information" | Rephrase the question, or increase `TOP_K` in `backend/config.py` |

---

## Configuration

All settings live in `backend/config.py` and `backend/.env`.
| Setting | Default | Effect |
|---|---|---|
| `CHUNK_SIZE` | `500` | Characters per chunk - lower for denser docs |
| `CHUNK_OVERLAP` | `100` | Overlap between chunks - prevents boundary misses |
| `TOP _K` | `5` | Chunks retrieved per query - increase for more context |
| `OLLAMA_MODEL` | `1lama3.1:8b` | Switch to `1lama3.2:3b` for speed, `mistral:7b` for quality |
| `num_ctx` | `4096` | LLM context window - increase to `8192` for longer answers |