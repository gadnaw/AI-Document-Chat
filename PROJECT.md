# AI Document Chat (RAG Pipeline)

## Overview

"Chat with your documents" application. Users upload PDFs and documents, then ask questions in natural language. AI answers are grounded in the actual document content with source citations and page references. This is the single most requested AI feature on Upwork -- RAG (Retrieval-Augmented Generation) is the #1 AI capability clients ask for.

## Goals

- Demonstrate mastery of the full RAG pipeline: embed, store, retrieve, generate
- Show understanding of embeddings, vector search, chunking strategies, and retrieval quality
- Prove ability to build streaming AI interfaces with source citations
- Demonstrate Supabase pgvector integration (upsell path for existing Supabase clients)
- Target Upwork job categories: AI/ML Development, Chatbot Development, Document Processing, Full-Stack Development

## Tech Stack

- **Framework:** Next.js 14+ App Router, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **AI SDK:** Vercel AI SDK (`useChat` hook for streaming, `streamText` for server)
- **LLM:** OpenAI GPT-4o for chat generation, text-embedding-3-small for embeddings (1536 dimensions)
- **Document Processing:** LangChain.js (document loaders for PDF/text, RecursiveCharacterTextSplitter for chunking)
- **Vector Database:** Supabase pgvector (PostgreSQL extension -- no separate vector DB needed)
- **Auth:** Supabase Auth (email/password)
- **File Storage:** Supabase Storage (for uploaded documents)
- **Deployment:** Vercel

## Pages / Screens

### Landing Page (`/`)
- Hero section explaining the product value proposition
- "Upload & Chat" call-to-action button
- Demo video or animated walkthrough showing the RAG experience
- Key features highlight (streaming, citations, multi-document)

### Upload Page (`/upload`)
- Drag-and-drop file upload zone (PDF, TXT, DOCX)
- File type validation (client-side + server-side)
- Chunking progress indicator showing: upload -> parsing -> chunking -> embedding -> stored
- Upload history with status indicators
- Maximum file size: 50MB per file

### Chat Page (`/chat`)
- Streaming AI responses (word-by-word via Vercel AI SDK `useChat`)
- Source citations with page numbers displayed inline or as expandable references
- Conversation history sidebar (list of past conversations)
- Active conversation with full message thread
- "New conversation" button
- Model indicator showing which model is active

### Documents Page (`/documents`)
- List of all uploaded documents with metadata (name, size, date, chunk count)
- Delete document action (removes document + all associated embeddings)
- Re-index action (re-chunk and re-embed a document)
- Document status: processing / ready / error

### Settings Page (`/settings`)
- Choose AI model: GPT-4o (higher quality) vs GPT-4o-mini (faster, cheaper)
- Adjust temperature slider (0.0 - 1.0, default 0.3 for factual answers)
- Chunk size preference (small/medium/large -- affects retrieval quality)

## Features

### Must-Have
- PDF upload and parsing via LangChain.js document loaders
- Text chunking with RecursiveCharacterTextSplitter (target: 500 tokens, 50-token overlap)
- Vector embedding generation via OpenAI text-embedding-3-small
- Similarity search using Supabase pgvector (cosine similarity, top-k=5, threshold=0.7)
- Streaming AI responses with Vercel AI SDK
- Source citations showing which document chunks informed the answer
- Conversation history (persisted to database)
- Multi-document support (query across all uploaded documents)
- Authentication via Supabase Auth

### Nice-to-Have
- Page number references in citations
- Conversation export (download as PDF/text)
- Document preview in-app
- Suggested follow-up questions
- Token usage display per query

## Data Model

### users
- `id` (uuid, PK) -- from Supabase Auth
- `email` (text)
- `created_at` (timestamptz)

### documents
- `id` (uuid, PK)
- `user_id` (uuid, FK -> users.id)
- `name` (text) -- original filename
- `file_path` (text) -- Supabase Storage path
- `file_size` (integer) -- bytes
- `chunk_count` (integer)
- `status` (text) -- 'processing' | 'ready' | 'error'
- `created_at` (timestamptz)

### document_chunks
- `id` (uuid, PK)
- `document_id` (uuid, FK -> documents.id)
- `content` (text) -- chunk text
- `embedding` (vector(1536)) -- pgvector column
- `chunk_index` (integer) -- position in document
- `page_number` (integer, nullable)
- `metadata` (jsonb) -- additional chunk metadata
- `created_at` (timestamptz)

### conversations
- `id` (uuid, PK)
- `user_id` (uuid, FK -> users.id)
- `title` (text) -- auto-generated from first message
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### messages
- `id` (uuid, PK)
- `conversation_id` (uuid, FK -> conversations.id)
- `role` (text) -- 'user' | 'assistant'
- `content` (text)
- `source_chunks` (jsonb, nullable) -- array of chunk IDs used for this response
- `created_at` (timestamptz)

### RLS Policies
- All tables: users can only access their own rows (`WHERE user_id = auth.uid()`)
- document_chunks: accessible via join through documents owned by user

## AI Architecture

### RAG Pipeline Flow
1. **Document Ingestion:** Upload -> Parse (LangChain PDF/text loaders) -> Chunk (RecursiveCharacterTextSplitter, 500 tokens, 50-token overlap) -> Embed (text-embedding-3-small) -> Store (Supabase pgvector)
2. **Query Processing:** User question -> Embed question (same model: text-embedding-3-small) -> Vector similarity search (cosine, top-k=5, threshold=0.7) -> Retrieve matching chunks
3. **Response Generation:** Assemble prompt (system instruction + retrieved chunks + user question) -> Stream response via GPT-4o/4o-mini -> Display with source references

### Chunking Strategy
- **Method:** RecursiveCharacterTextSplitter from LangChain.js
- **Target chunk size:** 500 tokens (~2000 characters)
- **Overlap:** 50 tokens (~200 characters) -- prevents losing context at boundaries
- **Why this size:** Small enough for precise retrieval, large enough to contain a complete thought. Chunks too large (2000+ tokens) return noisy context; chunks too small (<200 tokens) lose coherent meaning.

### Embedding Details
- **Model:** text-embedding-3-small (1536 dimensions)
- **Cost:** ~$0.02 per 1M tokens (~$0.00002 per query embedding)
- **Critical constraint:** The same embedding model must be used for both ingestion and queries. Switching models requires re-embedding all documents.

### Prompt Design
- **System prompt:** "You are a helpful assistant that answers questions based ONLY on the provided document context. If the answer is not found in the context, say 'I don't have information about that in the uploaded documents.' Always cite which document and section your answer comes from."
- **Context assembly:** Top-5 retrieved chunks formatted as numbered sources with document names
- **Hallucination control:** Explicit instruction to only answer from context + temperature=0.3

### Similarity Search (pgvector)
```sql
-- Match documents function for Supabase
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  document_id uuid,
  chunk_index int,
  similarity float
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
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Cost Estimation
- Embedding a query: ~$0.00002 (text-embedding-3-small)
- Chat generation: ~$0.0003-0.001 per query (GPT-4o-mini) or ~$0.003-0.01 (GPT-4o)
- Total per query: ~$0.001 with GPT-4o-mini
- At 1000 queries/day: ~$1/day = ~$30/month
- Document ingestion: ~$0.02 per 100-page PDF (one-time embedding cost)

## Security Requirements

- **Auth:** Supabase Auth with email/password login
- **RLS:** All tables protected -- users only see their own documents, conversations, and messages
- **File Storage:** Supabase Storage with RLS -- users only access their own uploaded files via signed URLs (temporary, expire in 60 seconds)
- **API Keys:** OpenAI key stored server-side only (environment variable), never exposed to client
- **Input Validation:** Message length limits, file type validation, file size limits
- **.env protection:** .gitignore includes .env*, .env.example with placeholder values committed

## Key Technical Decisions

- **pgvector over Pinecone:** For <100k documents (which covers most Upwork projects), pgvector in the same Supabase database eliminates an extra service, reduces cost to zero, and simplifies infrastructure. Pinecone is the scaling path if needed later.
- **LangChain.js for document processing, Vercel AI SDK for chat:** LangChain provides excellent document loaders and text splitters. Vercel AI SDK provides superior streaming UI via `useChat`. Using both plays to their strengths.
- **text-embedding-3-small over ada-002:** Newer model, same 1536 dimensions, better quality, lower cost. No reason to use ada-002 for new projects.
- **GPT-4o-mini as default, GPT-4o as upgrade:** Mini handles straightforward RAG Q&A well at 16x lower cost. GPT-4o available for complex multi-step reasoning when users need it.
- **500-token chunks with 50-token overlap:** Balances retrieval precision against context completeness. This is the most common production RAG configuration.

## Upwork Positioning

- **Project Catalog listings supported:** "AI-Powered Document Chat", "RAG Pipeline Development", "Custom AI Chatbot"
- **Price tiers enabled:** $2,000-5,000 (basic RAG), $5,000-15,000 (production RAG with advanced features)
- **Key selling points for proposals:**
  - "I've built a complete RAG pipeline from scratch -- upload, chunk, embed, retrieve, generate with streaming and source citations"
  - "Uses Supabase pgvector -- adds AI search to your existing database without a separate vector service"
  - "Streaming responses with source citations so users see answers building in real-time with references"
  - Portfolio demo link as proof of capability

## Build Estimate

- **Estimated effort:** 1-2 days with Claude Code
- **Priority:** #1 -- build first. RAG is the most requested AI feature on Upwork. This single demo covers the broadest range of AI job postings.
- **Build order rationale:** Every subsequent AI demo builds on RAG concepts learned here. A1's embedding/retrieval patterns transfer directly to A2 and A4.
