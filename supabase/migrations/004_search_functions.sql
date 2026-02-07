-- Migration: 004_search_functions.sql
-- Purpose: Database helper functions for common operations and vector similarity search
-- Functions: match_documents, get_user_documents, get_conversation_messages

-- Function: match_documents
-- Purpose: Perform vector similarity search on document chunks using cosine distance
-- Used by RAG pipeline in Phase 3 for semantic document retrieval
-- Parameters:
--   query_embedding: The vector embedding of the user's query
--   match_threshold: Minimum similarity score (0.0 to 1.0), default 0.7
--   match_count: Maximum number of results to return, default 5
-- Returns: Table with id, content, document_id, chunk_index, similarity score
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(256),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    document_id UUID,
    chunk_index INT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.document_id,
        dc.chunk_index,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function: get_user_documents
-- Purpose: Retrieve all documents owned by a specific user
-- Used for document listing in Phase 2 dashboard
-- Parameters:
--   user_id: UUID of the user whose documents to retrieve
-- Returns: Table with document id, user_id, name, created_at, status
CREATE OR REPLACE FUNCTION get_user_documents(user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    chunk_count INT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.user_id,
        d.name,
        d.file_size,
        d.mime_type,
        d.chunk_count,
        d.status,
        d.created_at,
        d.updated_at
    FROM documents d
    WHERE d.user_id = get_user_documents.user_id
    ORDER BY d.created_at DESC;
END;
$$;

-- Function: get_conversation_messages
-- Purpose: Retrieve all messages in a conversation ordered by creation time
-- Used for chat history in Phase 4 interface
-- Parameters:
--   conversation_id: UUID of the conversation to retrieve messages from
-- Returns: Table with message id, conversation_id, role, content, created_at
CREATE OR REPLACE FUNCTION get_conversation_messages(conversation_id UUID)
RETURNS TABLE (
    id UUID,
    conversation_id UUID,
    role TEXT,
    content TEXT,
    source_chunks JSONB,
    token_count INT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.conversation_id,
        m.role,
        m.content,
        m.source_chunks,
        m.token_count,
        m.created_at
    FROM messages m
    WHERE m.conversation_id = get_conversation_messages.conversation_id
    ORDER BY m.created_at ASC;
END;
$$;

-- Function: count_documents_by_status
-- Purpose: Count documents by processing status for a user
-- Useful for progress tracking during document ingestion
CREATE OR REPLACE FUNCTION count_documents_by_status(
    user_id UUID,
    status_filter TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    document_count INT;
BEGIN
    SELECT COUNT(*) INTO document_count
    FROM documents
    WHERE user_id = count_documents_by_status.user_id
      AND status = count_documents_by_status.status_filter;
    
    RETURN document_count;
END;
$$;

-- Function: get_document_with_chunks
-- Purpose: Retrieve document with all its chunks for processing
-- Used during document ingestion to chunk and embed documents
CREATE OR REPLACE FUNCTION get_document_with_chunks(document_uuid UUID)
RETURNS TABLE (
    document_id UUID,
    user_id UUID,
    document_name TEXT,
    chunk_id UUID,
    chunk_content TEXT,
    chunk_index INT,
    page_number INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS document_id,
        d.user_id,
        d.name AS document_name,
        dc.id AS chunk_id,
        dc.content AS chunk_content,
        dc.chunk_index,
        dc.page_number
    FROM documents d
    LEFT JOIN document_chunks dc ON d.id = dc.document_id
    WHERE d.id = document_uuid
    ORDER BY dc.chunk_index ASC;
END;
$$;
