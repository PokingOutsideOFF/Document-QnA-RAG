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

WHY /api/chat instead of api/generate (chanegd for conversation memory):
  /api/generate takes a single flat prompt string. Multi-turn conversation
  is possible but awkward, you manually concatenate "User: ... Assitant: ..."
  into one string and hope the model parses the formatting correctly.

  /api/chat takes a structured messages list:
   [
     {"role": "system",   "content": "You are QnA assitant"},
     {"role": "user",     "content": "What is X?"},
     {"role": "assitant", "content": "X is ..."}
   ]
   The model sees the conversation structure natively, it was trained on this format
   so it handles follow-up questions correctly without prompt hacks.

   The response token is now at data["message"]["content"] instead of 
   data["response"] the only parsing change needed.
  
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

WHY only send last 3 conversation pairs (not all history):
  Each prior turn consumes tokens from context window (4096 by default).
  Sending too much history squeezes out the retrived document chunks, which defeats
  the purpose of RAG. 3 pairs (6 messages) balances follow-up coherences against
  context window pressure.  

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

async def stream_ollama(messages: List[Dict[str, str]], model: str | None = None) -> AsyncIterator[str]:
    """
    Calls Ollama's /api/chat endpoint with stream=True.
    `messsages` is the full conversation: system + history + current_user_turn
    `model` overrides the default from config, used by the model switcher.
    """
    payload = {
        "model": model or settings.OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options":{
            "temperature":0.1,
            # num_ctx: the model's context window in tokens
            # Must be large enough to hold: system_prompt + retrieved_chunks + question + answer.
            # With TOP_K=5 and CHUNK_SIZE=500, chunks alone are ~600 tokens
            # 4096 is safe; increase to 8192 if answers cut off.
            "num_ctx": 4096,
        }
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                # /api/chat puts token at data["message"]["content"]
                # different from /api/generate which used data["response"]
                token = data.get("message", {}).get("content", "")
                if token:
                    yield token
                if data.get("done", False):
                    return

def build_prompt(question: str, retrieved_chunks: List[Dict], history: List[Dict[str, str]] | None = None) -> List[Dict[str, str]]:
    """
    Builds the messages list for /api/chat.

    Structure:
      [system]: grounding instructions always first
      [user/assitant]: prior conversation turns (last 3 pairs max)
      [user]: current quesion with retrieved context injected

    WHY inject context into CURRENT user message (not earlier turns)?
      Retrieval runs fresh for every question. The chunks relevant to "What
      is X?" are different from those relevant to "Can you elaborate on X?"
      Each turn retrieves its own context and injects it only into that turn's
      message, so the model always answers from fresh evidence, not stale context
      from a previous question.

    Returns a list of {role, content} dicts ready to send to /api/chat
    """

    system_message = {
        "role": "system",
        "content": (
            "You are a precise document Q&A assitant. "
            "Answer questions using ONLY the provided context passages"
            "If the answer is not in the context, say exactly: "
            "'I don't have enough information in the provided documents to answer that.' "
            "Cite which passage supports each claim using [Source N] notation"
        )
    }

    context_block = "\n\n".join(
        f"[Source {i + 1}] (from '{c['metadata']['source_filename']}', "
        f"chunk {c['metadata']['chunk_index']}):\n{c['text']}"
        for i, c in enumerate(retrieved_chunks)
    )

    current_user_message = {
        "role": "user",
        "content":(
            f"Context passages:\n{context_block}\n\n"
            f"Question: {question}\n\n"
            f"Answer: (cite sources using [Source N])"
        ),
    }

    messages = [system_message]
    if history:
        messages.extend(history)
    messages.append(current_user_message)

    return messages