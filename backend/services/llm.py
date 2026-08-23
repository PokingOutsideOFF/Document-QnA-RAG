"""
Ollama client: streams LLM responses token by token, and builds the RAG prompt

WHY OLLAMA: 
  Ollama packages open-source LLMs (Llama, Mistral, Gemma, etc.) into a
  local HTTP server with an OpenAI-compatibie API. You install it once, 
  pull a model with "ollama pull llama3.1:8b", and it runs entirely on your 
  machine - no API key, no data leaves your computer.

WHY STREAMING (not waiting for the full response): 
  llama3.1:8b generates ~20-50 tokens/second. A 200-word answer takes 5-10
  seconds to complete. Without streaming, the user stares at a blank screen
  for 10 seconds then sees the full response appear at once - poor UX. 
  With streaming, words appear as they are generated, exactly like ChatGPT.

  Technically: Ollama's /api/generate endpoint returns a chunked HTTP
  response where each chunk is JSON line like:
   {"response":"The", "done": false}
   {"response": " answer", "done": false}
   {"response": " is...", "done": true}
  We yield each "response" token as it arrives. FastAPI forwards it to the 
  browser as a Server-Sent Event immediately (no buffering).

WHY httpx(not requests):
  The `requests` library reads the entire response into memory before 
  returning it. httpx.AsyncClient with client.stream() reads the response 
  line-by-line as it arrives, which is what makes real-time streaming work.

WHY temperature=0.1:
  Temperature controls how "creative" vs "predictable" the LLM is
  - temperature=1.0: the model samples freely from all likely next tokens 
  - temperature=0.1: the model almost always picks the highest-probability token
  For RAG, we want the model to synthesize the retrieved passages accurately, 
  not invent creative variations. Low temperature = more faithful, factual output.

NHY the system prompt says "I don't have enough information": 
  Without explicit grounding instructions, LLMs hallucinate. They will 
  synthesize a plausible-sounding answer from their training data rather than 
  admitting the documents don't contain the answer. This instruction anchors 
  the model to the retrieval context.

WHY [Source N] citation format:
  We inject "Source 1", "Source 2", etc. labels into the context block.
  The system prompt instructs the model to use these labels in its answer. 
  The frontend then matches these labels to the citation objects it received 
  earlier in the SSE stream, enabling clickable source badges.
"""


import httpx
import json
from typing import AsyncIterator, List, Dict

from config import settings

async def stream_ollama(prompt: str, system_prompt: str, model: str | None = None) -> AsyncIterator[str]:
    """
    Calls Ollama's /api/generate endpoint with stream=True.
    Yields individual token strins as they arrive from the model.
    `model` overrides the default from config, used by the model switcher.
    """
    payload = {
        "model": model or settings.OLLAMA_MODEL,
        "prompt": prompt,
        "system": system_prompt,
        "stream": True,
        "options":{
            "temperature":0.1,
            #num_ctx: the model's context window in tokens
            # Must we large enough to hold: system_prompt + retrieved_chunks + question + answer.
            # With TOP_K=5 and CHUNK_SIZE=500, chunks alone are ~600 tokens
            #4096 is safe; increase to 8192 if answers cut off.
            "num_ctx": 4096,
        }
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                token = data.get("response", "")
                if token:
                    yield token
                if data.get("done", False):
                    return

def build_prompt(question: str, retrieved_chunks: List[Dict]) -> tuple[str, str]:
    """
    Constructs the system prompt

    The context block lists each retrieved chunk with a [Source N] label.
    The model is instructed to reference these labels in its answer - 
    the frontend uses them to render clickable citation badges.

    Returns: (syste,_prompt, user_prompt) as seperate strings.
    Ollama handles them seperately to apply the correct chat templates for the model.
    """

    system_prompt = (
        "You are a precise document Q&A assitant. "
        "Answer questions using ONLY the provided context passages"
        "If the answer is not in the context, say exactly: "
        "'I don't have enough information in the provided documents to answer that.' "
        "Cite which passage supports each claim using [Source N] notation"
    )

    context_block = "\n\n".join(
        f"[Source {i + 1}] (from '{c['metadata']['source_filename']}', "
        f"chunk {c['metadata']['chunk_index']}):\n{c['text']}"
        for i, c in enumerate(retrieved_chunks)
    )

    user_prompt = (
        f"Context passages:\n{context_block}\n\n"
        f"Question: {question}\n\n"
        f"Answer: (cite sources using [Source N])"
    )

    return system_prompt, user_prompt