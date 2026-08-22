"""
Document router: handles file upload, listing and deletion

Upload pipeline (the full RAG ingestion flow):
1. Validate file extension
2. Save file temporarilly to disk (async, non-blocking)
3. Parse: split text into overlapping segments
4. Embed: convert each chunk to a 384-dim vector
5. Store: save vectors + metadata to Chroma
6. Clean up: delete the temp file

Steps 3-6 are the "indexing" phase of RAG. After this, the document is searchable - no more file needed, only vectors in Chroma.
"""
import os
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, HTTPException, UploadFile

from config import settings
from models.schemas import DocumentListResponse, DocumentUploadResponse
from services.chunker import chunk_text
from services.embedder import embed_texts
from services.parser import parse_file
from services.vector_store import add_chunks, delete_document, list_documents

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...)):
    # Validate extension beforetouching the file
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code = 400, detail=f"Unsupported file type: {ext}. Allowed types: {settings.ALLOWED_EXTENSIONS}")

    # Save to disk temporarily so parser.py can open it by path
    upload_path = Path(settings.UPLOAD_DIR) / file.filename
    upload_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(upload_path, 'wb') as f:
        content = await file.read()
        await f.write(content)

    try:
        # --- Ingestionn pipeline ---
        raw_text = parse_file(str(upload_path))
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="File appears empty or unreadbale")

        chunks = chunk_text(raw_text, source_filename = file.filename)
        embeddings = embed_texts([c.text for c in chunks])
        add_chunks(chunks, embeddings)

        return DocumentUploadResponse(
            filename=file.filename,
            chunks_indexed=len(chunks),
            message=f"Succesfully indexed {len(chunks)} chunks from '{file.filename}"
        )
    finally:
        # Always remove the temp file - we only need the vectors in Chroma now
        if upload_path.exists():
            os.remove(upload_path)


@router.get("/", response_model=DocumentListResponse)
async def get_document():
    """Returns the list of unique document filenames currently indexed in Chroma"""
    return DocumentListResponse(documents=list_documents())

@router.delete("/{filename}")
async def remove_document(filename: str):
    """Remove all chunks belonging to a document from Chroma"""
    count = delete_document(filename)
    if count == 0:
        raise HTTPException(status_code=404, detail=f"Document: {filename} not found")
    return {"message": f"Deleted {count} chunks for '{filename}'"}
