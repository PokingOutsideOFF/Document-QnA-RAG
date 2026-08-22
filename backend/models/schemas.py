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


class QueryResult(BaseModel):
    question: str
    top_k: Optional[int] = None # overrides config default when provided

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
