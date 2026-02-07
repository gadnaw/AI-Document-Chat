-- Migration: 002_rls_policies.sql
-- Purpose: Enable Row Level Security and create access policies for data isolation
-- Principle: Users can only access their own data via auth.uid()
-- Note: Enable RLS on tables and create policies for authenticated access

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Create policies for documents table
-- Users can view their own documents
CREATE POLICY "Users can view own documents" ON documents
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents" ON documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents" ON documents
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents" ON documents
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create policies for document_chunks table
-- Users can view chunks from their own documents (via join through documents)
CREATE POLICY "Users can view own document chunks" ON document_chunks
    FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM documents WHERE user_id = auth.uid()
        )
    );

-- Users can insert chunks for their own documents
CREATE POLICY "Users can insert chunks for own documents" ON document_chunks
    FOR INSERT
    WITH CHECK (
        document_id IN (
            SELECT id FROM documents WHERE user_id = auth.uid()
        )
    );

-- Users can update chunks for their own documents
CREATE POLICY "Users can update chunks for own documents" ON document_chunks
    FOR UPDATE
    USING (
        document_id IN (
            SELECT id FROM documents WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        document_id IN (
            SELECT id FROM documents WHERE user_id = auth.uid()
        )
    );

-- Users can delete chunks from their own documents
CREATE POLICY "Users can delete chunks from own documents" ON document_chunks
    FOR DELETE
    USING (
        document_id IN (
            SELECT id FROM documents WHERE user_id = auth.uid()
        )
    );

-- Create policies for conversations table
-- Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own conversations
CREATE POLICY "Users can create own conversations" ON conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations" ON conversations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations" ON conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create policies for messages table
-- Users can view messages from their own conversations (via join through conversations)
CREATE POLICY "Users can view own conversation messages" ON messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Users can insert messages into their own conversations
CREATE POLICY "Users can insert messages into own conversations" ON messages
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Users can update messages in their own conversations
CREATE POLICY "Users can update own conversation messages" ON messages
    FOR UPDATE
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Users can delete messages from their own conversations
CREATE POLICY "Users can delete own conversation messages" ON messages
    FOR DELETE
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Create policies for citations table
-- Users can view citations from their own messages (via join through messages/conversations)
CREATE POLICY "Users can view own message citations" ON citations
    FOR SELECT
    USING (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- Users can create citations for their own messages
CREATE POLICY "Users can create citations for own messages" ON citations
    FOR INSERT
    WITH CHECK (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- Users can update their own citations
CREATE POLICY "Users can update own citations" ON citations
    FOR UPDATE
    USING (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- Users can delete their own citations
CREATE POLICY "Users can delete own citations" ON citations
    FOR DELETE
    USING (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- Verify RLS is enabled on all tables
-- Run this to verify: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
