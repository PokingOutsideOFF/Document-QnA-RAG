"""
Query router: the SSE streaing endpint that powers the chat interface

HOW THE FULL QUERY PIPELINE WORKS
 1. Embed the question -> a 384-dim query vector
 2. Search Chroma for the TOP_K chunks closest to that vector
 3. Send "citation" SSE event with the retrieved chunks (before any tokens)
 4. Build a LLM prompt: system instructions + retrived chunks + question
 5. Stream Ollam's respinse token by token as "token" SSE events
 6. Send a "done" SSE event to signal completion

WHY SERVER-SENT EVENTS (SSE):
 SSE is a standard HTTP protocol where the server keeps the connection open
 and pushes data in the format "data": <payload>\n\n". The browser reads 
 these as they arrive. It is:
 - Simpler than WebSockets (one-way: server -> client only, which is all we need)
 - Works through HTTP proxies and load balancers
 - Has built-in browser reconnection logic
 - Plain HTTP - no special protocol upgrade needed 

WHY WE SEND CITATIONS FIRST (before tokens):
 The frontend attaches the citation list to message object as soon as 
 the citation event arrives. When the stream completes and the UI renders
 the source badges, they are already in state - no second network requrest
 needed. If we citations last, the badges would appear with a visible pop-in
 delay after the text stopped streaming.

WHY FastAPI StreaminResponse:
 A regular FastAPI endpoint buffers the entire response before sending it.
 StreamingResponse takes an async generator and forwards each yielded chunk
 to the client immediately without buffering. This is what allow tokens to
 appear in the browser as fast as Ollam generates them.
"""

import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from config import settings
from models.schemas import Citation
from services.embedder import embed_query
from services.llm import build_prompt, stream_ollama
from services.vector_store import query_similar

router = APIRouter(prefix="/query", tags=["query"])

@router.post("/")
async def query_document(request: Request):
    body = await request.json()
    question = body.get("question", "").strip()
    top_k = body.get("top_k", settings.TOP_K)

    async def event_generator():
        if not question:
            yield f'data: {json.dumps({"type": "error", "error": "Question cannot be empty"})}\n\n'
            return

        # Step 1: embed the question using same model used at indexing time.
        # This is critical - query and document vectors must be in the same
        # embedding space, which only happens if you use the same model for both.
        query_vec = embed_query(question)

        # Step 2: retrieve the top-K most semantically similar chunks
        retrieved = query_similar(query_vec, top_k=top_k)

        # Step 3: send citations FIRST so the frontend has them before tokens arrive
        citations = [
            Citation(
                source_filename=r["metadata"]["source_filename"],
                chunk_index=r["metadata"]["chunk_index"],
                chunk_text=r["text"],
                distance=r["distance"],
            ).model_dump()
            for r in retrieved
        ]
        yield f'data: {json.dumps({"type": "citation", "citations": citations})}\n\n'

        # Step 4: build the prompt (system + context + question)
        system_prompt, user_prompt = build_prompt(question, retrieved)

        # Step 5: stream tokens from Ollama one by one
        async for token in stream_ollama(user_prompt, system_prompt):
            yield f'data: {json.dumps({"type": "token", "content": token})}\n\n'

        # Step 6: signal that streaming is complete
        yield f'data: {json.dumps({"type": "done"})}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream',
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disables Nginx/proxy response buffering if the app is ever deployed
            # behind a reverse proxy - without this, proxies buffer SSE and the 
            # browser receives all tokens at once instead of one at a time.
            "X-Accel-Buffering": "no",
        }
    )