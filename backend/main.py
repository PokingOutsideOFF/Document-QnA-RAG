from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import documents, models, query

app = FastAPI(
    title = "Local RAG Q&A",
    description = "Docuemnt RAG Q&A using Ollama (local) or Groq (production) + sentence-transformers + Chroma",
    version = "1.0.0",
)

# ALLOWED_ORIGINS is a comma-seperated string from config (env var in production)
# Splitting it here gives a listwithout hardcoding either in source code.
# WHY env var: the frontend URL changes between local dev and production never hardcode the production URL in source code.
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(models.router)
app.include_router(query.router)

@app.get("/health")
async def health():
    return {"status": "ok"}