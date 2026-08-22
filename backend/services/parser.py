"""
Document parser: converts uploaded files to raw text strings

WHY THIS EXISTS:
  All downstream steps (chunking, embedding, indexing) work on plain text.
  We need a single function that accepts any supported file type and returns 
  a uniform string, so the rest of the pipeline never needs to know about 
  file formats.

WHY PyMUPDF (imported as 'fitz'): 
  It is the fastest Python PDF library and handles complex layouts - 
  multi-column pages, embedded fonts, ligatures - better than pypdf or 
  pdfplumber. It extracts the text layer directly without rendering to an 
  image (so it does NOT work on scanned PDFs with no text layer).
"""

import fitz # PyMuPDF
from docx import Document
from pathlib import Path

def parse_file(file_path: str) -> str:
    """
    Accepts an absoulte file path. Returns the full extracted text as one string.
    Raises ValueError for unsupported e`xtensions
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".pdf":
        return _parse_pdf(path)
    elif ext == ".docx":
        return _parse_docx(path)
    elif ext == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsuported file type: {ext}")

def _parse_pdf(path: Path) -> str:
    doc = fitz.open(str(path))
    # Double newline between pages preserve the semantic boundary -
    # the chunker may split naturally rather than mid-sentence
    pages = [page.get_text("text") for page in doc]
    doc.close()
    return "\n\n".join(pages)

def _parse_docx(path: Path) -> str:
    doc = Document(str(path))
    # Filter blank paragraphs to avoid noisy empty chunks later.
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)