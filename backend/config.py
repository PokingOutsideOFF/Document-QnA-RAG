from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    #Ollama - runs locally, no API key needed
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"

    #Chroma vector store - persists to disk in this folder
    CHROMA_PATH: str = "./chroma_db"
    CHROMA_COLLECTION: str = "documents"

    # Chunking parameters - the most important turning knobs in RAG
    # CHUNK_SIZE: how many characters per  chunk
    # CHUNK_OVERLAP: how many characters to overlap between chunks
    # See service/chunker.py for a detailed explanation
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 100

    # How many chunks to retrieve per query
    # More chunks = more context, but also more noise and slower response times
    TOP_K: int = 10

    # Cosine distance threshold - chunks with distance > this are considered irrelevant
    # Cosine distance: 0.0 = identical vectors , 1.0 = completely unrelated.
    # 0.5 is good starting point, lower = stricter(fewer but better results).
    RELEVANCE_THRESHOLD: float = 0.8

    UPLOAD_DIR: str = "./uploads"
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".txt", ".docx"]
    MAX_FILE_SIZE_MB: int = 50

    class Config:
        env_file = ".env"

settings = Settings()