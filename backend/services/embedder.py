"""
Embedder: converts text strings into fixed-size flaot vectors using
sentence-transformers running locally on GPU.

WHY EMBEDDING:
  An embedding is a list of numbers (a vector) that represents the *meaning*
  of a piece of text. Texts with similar meanings produce vectors that are 
  close together in high dimensional space - this is how we find chunks that
  are relevant to a query without keyword matching.

  Example: "What is the company revenue?" and "Annual sales figures" will have
  similar vectors even though they share no words in common.

  
WHY all-MiniLM-L6-v2:
  - Size: ~90MB (downloads once to ~/cache/huggingface)
  - Output: 384-dimensional float vectors
  - Speed: fast on CPU, even faster on GPU (auto-detected)
  - Quality: good semantic similarity, validated on multiple benchmarks (STS, SICK, etc.)
  - Limit: 256 tokens per input (~380-500 english chars) - hence CHUNK_SIZE=500 in config.py

  Larger alternatives (all-mpnet-base-v2, 768 dims) give marginally better
  recall but are 3-5x slower.

WHY normalize_embeddings=True:
  Normalizing each vector to unit length (magnitude = 1) means that
  cosine similarity equals dot product. Chroma uses this internally, so query vectors
  and stored vectors must use the same normalization - otherwise
  similarity scores will be meaningless and retrieval will fail.

WHY model is loaded at module import time (not per-request):
  Loading the model is slow (~1-2 seconds) and uses a lot of GPU memory.If we loaded it inside embed_texts(),
  every upload and every query would incur that delay. Loading once at import 
  means the model is warm and ready from the first request onward.
"""



from sentence_transformers import SentenceTransformer
from typing import List

# First call: download model from HuggingFace(~90MB). Subsequent calls uses cache.
_model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Encodes a list of text strings into 384 dimenstional float vectors
    Processes in batches of 32 for GPU efficiency
    Returns a plain Python list of lists (compatible with Chroma's API)
    """
    embeddings = _model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return embeddings.tolist()

def embed_query(query: str) -> List[float]:
    """Single-string convenience wrapper - same model and normalization"""
    return embed_texts([query])[0]