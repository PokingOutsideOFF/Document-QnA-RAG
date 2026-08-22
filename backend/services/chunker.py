"""
Text chunker : splits a long document string into overlapping Chunk objects

WHY CHUNKING IS THE MOST IMPORTANT STEP IN RAG:

 1. Embedding model limits - all-MiniLM-L6-v2 was trained on sequences up to 
    256 tokens (~300-500 English characters). Feeding it a 50 page document
    produces a single averaged vector that loses almost all positional meaning
    Short chunks produce focuesd, topically-specific vectors that match queries
    with much higher precision.

 2. LLM context limits - even though llama3.1.8b supports 128K tokens, sending 
    an entire document with query is slow and wastes the context window.
    We retrieve only the 5 most relevant chunks (~2500 characters in total),
    leaving plenty of room for the question and the answer

 3. Retrieval precision - a chunk about "revenue in Q3" will match the query
     "what was the Q3 revenue?" far better than a chunk covering 20 topics at once.

     
WHY OVERLAP:
    If a key sentence straddles the boundary between chunk 4 and 5, each 
    half alone is semantically incomplete incomplete and may not be retrieved. Overlap ensures
    boundary sentences appear fully in at leat one chunk.

    With CHUNK_SIZE=500 and CHUNK_OVERLAP=100 you get 20% overlap, which is the
    empirically validated starting point for English prose.

TUNING GUIDE (aadjust config.py, not this file):
    - Dense technical content (legal, scientific): try CHUNK_SIZE=300
    - Narrative prose (reports, articles): try CHUNK_SIZE=700
    - Always keep (TOP_K x CHUNK_SIZE) < Ollama's num_ctx setting 
     
"""


from dataclasses import dataclass
from typing import List

from config import settings

@dataclass
class Chunk:
    text: str
    chunk_index: int # 0 based position within this document
    start_char: int # character offset in the original text
    end_char: int
    source_filename: str

def chunk_text(text: str, source_filename: str) -> List[Chunk]:
    """
    Slides a window of CHUNK_SIZE characters across `text` with a step of
    (CHUNK_SIZE - CHUNK_OVERLAP) characters, produces overlapping Chunk objects 
    """
    chunks: List[Chunk] = []
    size = settings.CHUNK_SIZE
    overlap = settings.CHUNK_OVERLAP
    step = size - overlap # advance by this many characters each iteration

    start = 0 
    index = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunk_str = text[start:end].strip()

        if chunk_str: #skip whitespaces-only windows
            chunks.append(Chunk(
                text=chunk_str,
                chunk_index=index,
                start_char=start,
                end_char=end,
                source_filename=source_filename,
            ))
            index += 1

        start += step

    return chunks