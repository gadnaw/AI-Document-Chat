-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index on document_chunks embedding column
-- Optimized for text-embedding-3-small (256 dimensions)
CREATE INDEX ON document_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Set runtime parameter for queries (can be set per-session)
-- Higher ef_search = better recall, slightly slower
SET hnsw.ef_search = 100;

-- Enable iterative scan for threshold filtering support
SET hnsw.iterative_scan = strict_order;
SET hnsw.max_scan_tuples = 1000;

-- Create RPC function for vector similarity search
CREATE OR REPLACE FUNCTION search_chunks(
  p_query_embedding vector(256),
  p_user_id uuid,
  p_document_ids uuid[] DEFAULT NULL::uuid[],
  p_threshold numeric DEFAULT 0.7,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  page_number integer,
  metadata jsonb,
  document_name text,
  similarity numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    c.page_number,
    c.metadata,
    d.name as document_name,
    (c.embedding <=> p_query_embedding) as similarity
  FROM document_chunks c
  JOIN documents d ON c.document_id = d.id
  WHERE d.user_id = p_user_id
    AND (p_document_ids IS NULL OR c.document_id = ANY(p_document_ids))
    AND (c.embedding <=> p_query_embedding) <= (1 - p_threshold)
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Comment on function for documentation
COMMENT ON FUNCTION search_chunks IS 
  'Performs HNSW cosine similarity search on document chunks with RLS enforcement';
