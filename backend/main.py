from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import documents, query

app = FastAPI(
    title = "Local RAG Q&A",
    description = "A local RAG Q&A system that allows you to upload documents and ask questions about them.",
    version = "1.0.0",
)

# CORS lets the Next.js dev server (localhost: 3000) call this API.
# Without it, browsers block cross-origin requests for security reasons.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(query.router)

@app.get("/health")
async def health():
    return {"status": "ok"}