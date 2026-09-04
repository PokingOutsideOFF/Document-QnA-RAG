"""
Models router: returns the list of available LLM models.

WHY it exists: 
  The frontend model dropdown previouslt called Ollama directly from the browser
  (/api/tags). That works locally but in production the deployed browser can't 
  reach the localhost

  Moving model discovery to backend fixes this: the backend knows whether it's
  running with Ollama or Groq(via USE_GROQ), and returns list.
  The frontend calls GET /models/
"""

import httpx
from fastapi import APIRouter
from config import settings

router = APIRouter(prefix="/models", tags=["models"])

# Groq's available llama models (free tier)
# Suitable for RAG
GROQ_MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile"
    "llama3-8b-8192"
    "llama3-70b-8192"
]

@router.get("/")
async def list_models():
    """
    Returns available models based on the current LLM backend.
    - USE_GROQ=true -> returns a fixed list of Groq models
    - USE_GROQ=false -> proxies the Ollama /api/tags endpoint
    """

    if settings.USE_GROQ:
        return {"models": GROQ_MODELS}

    # Proxy the Ollama model list from the backend (avoid localhost CORS issue in prod)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            res.raise_for_status()
            data = res.json()
            names = [m["name"] for m in data.get("models", [])]
            return {"models": names}
    except Exception:
        return {"models": []}
