"""
Vector store wrapper: stores and searches document embeddings using Chroma.

WHY A VECTOR STORE:
  After embedding every chunk, you have thousands of 384-dimensional vectors.
  When a query arrives, you embed the question and need to find the chunks 
  whose vectors are most similar to the query vector.

  Naively, you'd compute the similarity between the query and every stored 
  vector (brute force). With 50,000 chunks that's 50,000 dot products per 
  query - fast for small collections, but slow for large ones.

  A vector store uses an index structure (here: HNSW) to answer "find the 
  top-5 most similar vectors" in milliseconds regardless of collection size.

WHY CHROMA:
  - Runs in the same process as FastAPI - no separate server to manage 
  - PersistentClient writes the index to disk, so data survives restarts 
  - Simple Python API that maps cleanly to our use case 
  - Easy to swap for Qdrant, Weaviate, or pgvector later if needed

WHY HNSW (Hierarchical Navigable Small World):
  HNSW builds a multi-layer graph where each node is connected to its 
  nearest neighbors. A query traverses the graph greedily to find approximate 
  nearest neighbors in 0(log n) time instead of 0(n). "Approximate" means 
  it may occasionally miss the absolute best match, but in practice the 
  difference is negligible for RAG applications.

WHY cosine distance (not Euclidean): 
  Cosine distance measures the angle between two vectors, ignoring magnitude 
  since we normalize all embeddings to unit length, cosine similarity equals 
  dot product - it measures whether two texts point in the same semantic 
  direction. Euclidean distance would penalize vectors that happen to have 
  different magnitudes, which is meaningless for normalized embeddings.
"""


import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any

from config import settings
from services.chunker import Chunk

_client = chromadb.PersistentClient(
    path=settings.CHROMA_PATH,
    settings=ChromaSettings(anonymized_telemetry=False),
)

_collection = _client.get_or_create_collection(
    name=settings.CHROMA_COLLECTION,
    metadata={"hnsw:space":"cosine"},
)

def add_chunks(chunks: List[Chunk], embeddings: List[List[float]]) -> None:
    """
    Stores chunks and their vector in Chroma
    The ID format "filename::chunk::N" makes deletion by document easy.
    """
    _collection.add(
        ids=[f"{c.source_filename}::chunk::{c.chunk_index}" for c in chunks],
        embeddings=embeddings,
        documents=[c.text for c in chunks],
        metadatas=[{
            "source_filename": c.source_filename,
            "chunk_index": c.chunk_index,
            "start_char": c.start_char,
            "end_char": c.end_char
        } for c in chunks],
    )

def query_similar(query_embedding: List[float], top_k: int) -> List[Dict[str, Any]]:
    """
    Returns the top_k chunks whose embeddings are closest to the query vector.
    Each result dict has: text, metadata (filename, chunk_index), distance.
    Distance is cosine distance: 0 = identical, 2 = opposite
    """
    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    # Chroma returns nested lists because it supports batch queries
    # [0] unpacks the single-query case.
    return [
        {"text": text, "metadata": meta, "distance": dist}
        for text, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]

def delete_document(filename: str) -> int:
    """Deletes all chunkls belonging to a document. Returns the count deleted."""
    results = _collection.get(
        where={"source_filename": filename},
        include=[], # we only need the IDs
    )
    ids = results["ids"]
    if ids:
        _collection.delete(ids=ids)
    return len(ids)

def list_documents() -> List[str]:
    """Returns unique filenames of all indexed documents."""
    all_meta = _collection.get(include=["metadatas"])["metadatas"]
    return list({m["source_filename"] for m in all_meta})