from pydantic import BaseModel
from typing import Optional, List

class DocumentUploadResponse(BaseModel):
    filename: str
    chunks_indexed: int
    message: str

class DocumentListResponse(BaseModel):
    documents: List[str]

class Citation(BaseModel):
    source_filename: str
    chunk_index: int
    chunk_text: str # the actual message shown in the frontend popover on hover
    distance: float #cosine distance between the query and the chunk embedding

class HistoryMessage(BaseModel):
    role: str # user or assitant
    content: str

class QueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = None # overrides config default when provided
    model: Optional[str] = None # Ollama model to use (override config default)
    document_filter: Optional[List[str]] = None # if set, only search those filenames
    history: Optional[List[HistoryMessage]] = None # prior conversation turns (last N pairs)

# Every Server-Sent Event the backend sends to the browser is one of these shapes:
# {"type": "citation", "citations": [...]} - sent first, before any tokens
# {"type": "token", "content": "Hello"}    - one per LLM token
# {"type": "done"}                         - signals stream complete
# {"type": "error", "error": "..."}        - something went wrong
class SSEEvent(BaseModel):
    type: str
    content: str = ""
    citations: Optional[List[Citation]] = None
    error: Optional[str] = None
