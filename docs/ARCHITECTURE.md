# System Architecture

This document provides a comprehensive overview of the AI Document Chat system architecture, including components, data flow, technology stack, and integration points.

## Table of Contents

- [Overview](#overview)
- [High-Level Architecture](#high-level-architecture)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [External Integrations](#external-integrations)
- [Security Architecture](#security-architecture)
- [Performance Considerations](#performance-considerations)

---

## Overview

The AI Document Chat is a Retrieval-Augmented Generation (RAG) application that enables users to upload PDF documents and engage in contextual conversations with AI-powered search and citation.

### Core Capabilities

1. **Document Processing**: Upload, parse, chunk, and embed PDF documents
2. **Semantic Search**: Find relevant content using vector similarity
3. **Conversational AI**: Chat with documents using GPT-4o with citations
4. **Secure Access**: User authentication and data isolation via RLS

### Key Design Principles

- **User Privacy First**: All data is private and isolated per user
- **Reliability**: Graceful degradation and circuit breakers
- **Observability**: Comprehensive monitoring and alerting
- **Scalability**: Stateless design for horizontal scaling

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Web App    │  │   Mobile    │  │    API      │              │
│  │  (Next.js)  │  │   (PWA)     │  │  (REST)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    Application Layer                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Next.js Server                              ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   ││
│  │  │ Auth API │  │ Chat API │  │ Doc API  │  │ Search   │   ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                           │                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Business Logic Layer                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          ││
│  │  │ Processing  │  │ Retrieval  │  │   Circuit   │          ││
│  │  │  Pipeline   │  │   Engine    │  │   Breaker   │          ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘          ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                     Data Layer                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Supabase   │  │   Upstash   │  │   Sentry    │              │
│  │  (Database) │  │   (Cache)   │  │  (Monitoring)│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                   External Services                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  OpenAI     │  │  Supabase   │  │   Cloud     │              │
│  │  (LLM/Embed)│  │  (Auth)     │  │   Storage   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Frontend (Next.js)

**Role**: User interface and client-side logic

**Responsibilities**:
- Render React components for chat, documents, and settings
- Handle user interactions and state management
- Manage authentication state and session
- Stream AI responses to users

**Key Components**:
- `ChatInterface`: Main chat UI with streaming
- `DocumentList`: Document management
- `CitationPanel`: Source citations display
- `AuthProvider`: Authentication context

### API Routes

**Auth API** (`/api/auth/*`):
- User authentication and session management
- JWT token validation
- Protected route middleware

**Chat API** (`/api/chat/*`):
- Message handling and streaming
- Context retrieval
- Citation generation
- Token usage tracking

**Documents API** (`/api/documents/*`):
- Upload handling and validation
- Processing status tracking
- Document CRUD operations

**Search API** (`/api/search`):
- Query embedding generation
- Vector similarity search
- Result ranking and filtering

### Business Logic Layer

**Document Processing Pipeline**:
1. Receive uploaded file
2. Validate file type and size
3. Extract text using PDF parser
4. Chunk text using semantic splitter
5. Generate embeddings via OpenAI
6. Store embeddings in pgvector

**Retrieval Engine**:
1. Receive user query
2. Generate query embedding
3. Search vector database
4. Filter by threshold
5. Return top-k results

**Circuit Breaker**:
- Protect external service calls
- Prevent cascading failures
- Enable graceful degradation

---

## Data Flow

### Document Upload Flow

```
User → Frontend → API Route → Storage → Processing → Embeddings → Database
                     ↓                                              ↓
              Auth Check                                     Supabase
                                                          (pgvector)
```

1. User selects PDF file
2. Frontend validates file type/size
3. Authenticated request to `/api/documents/upload`
4. File uploaded to Supabase Storage
5. Processing job queued
6. Text extraction and chunking
7. Embedding generation via OpenAI
8. Vectors stored in pgvector
9. Status updated to "processed"

### Chat Query Flow

```
User → Frontend → Chat API → Retrieval → OpenAI → Response → User
                ↓              ↓            ↓
           Auth Check      Cache       Citations
                        (Upstash)    (Database)
```

1. User sends message
2. Frontend validates and streams to API
3. API validates authentication
4. Query embedded via OpenAI
5. Similar documents retrieved from pgvector
6. Context prepared with citations
7. GPT-4o generates response
8. Response streamed to user with sources

### Error Handling Flow

```
Error → Monitoring → Alerting → Dashboard
   ↓            ↓            ↓
Sentry      Slack/Email   Metrics
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14+ | React framework with App Router |
| React | 18+ | UI component library |
| TypeScript | 5+ | Type safety |
| Tailwind CSS | 3+ | Styling |
| Vercel AI SDK | 3+ | AI integration |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14+ | Server and API routes |
| TypeScript | 5+ | Type safety |
| Node.js | 18+ | Runtime |
| LangChain.js | 1+ | LLM orchestration |

### Database & Storage

| Technology | Purpose |
|------------|---------|
| Supabase (PostgreSQL) | Primary database with RLS |
| pgvector | Vector similarity search |
| Supabase Storage | Document file storage |
| Upstash Redis | Caching and rate limiting |

### AI/ML Services

| Service | Purpose |
|---------|---------|
| OpenAI GPT-4o | Chat completion |
| OpenAI text-embedding-3-small | Vector embeddings |

### Monitoring & Analytics

| Service | Purpose |
|---------|---------|
| Sentry | Error tracking |
| Vercel Analytics | Performance monitoring |
| Custom Uptime Monitor | System health |

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Documents Table

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  size_bytes BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Chunks Table (with embeddings)

```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Conversations Table

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Messages Table

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## External Integrations

### OpenAI

**Endpoints Used**:
- `/v1/chat/completions` - Chat responses
- `/v1/embeddings` - Vector generation

**Rate Limits**:
- GPT-4o: 500 RPM, 30,000 TPM
- Embeddings: 3,000 RPM

**Error Handling**:
- Circuit breaker with 3 failure threshold
- Automatic retry with exponential backoff

### Supabase

**Services Used**:
- Auth - User authentication
- Database - PostgreSQL with pgvector
- Storage - Document file storage
- Realtime - Progress notifications

**Error Handling**:
- Circuit breaker with 5 failure threshold
- Connection pooling for performance

### Upstash Redis

**Features Used**:
- Rate limiting
- Query caching
- Session storage

**Error Handling**:
- Graceful degradation on failures
- Cache miss fallback to database

---

## Security Architecture

### Authentication Flow

```
User Login → Supabase Auth → JWT Token → Client
    ↓                                    ↓
                                    API Requests with Token
                                              ↓
                                    Token Validation
                                              ↓
                                    User Context
```

### Row Level Security (RLS)

All tables have RLS enabled:

```sql
-- Users can only access their own data
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own documents"
  ON documents FOR ALL
  USING (auth.uid() = user_id);
```

### Data Isolation

- Each user has unique identifier (UUID)
- All queries filtered by authenticated user ID
- Storage buckets private by default
- No cross-user data access possible

### API Security

- HTTPS enforced in production
- Rate limiting per user
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS prevention via React escaping

---

## Performance Considerations

### Document Processing

**Optimization Strategies**:
- Async processing with status updates
- Batch embedding generation
- Streaming for large files
- Compression for transfers

**Benchmarks**:
- Small docs (<1MB): < 10s processing
- Medium docs (1-10MB): < 30s processing
- Large docs (>10MB): < 60s processing

### Query Performance

**Optimization Strategies**:
- Vector index (HNSW) for fast similarity search
- Redis cache for repeated queries
- Connection pooling for database
- Async streaming for responses

**Benchmarks**:
- Query embedding: < 500ms
- Vector search: < 100ms
- LLM response: < 2s first token
- Total response: < 3s

### Scalability

**Horizontal Scaling**:
- Stateless API servers
- Serverless deployment (Vercel)
- Automatic scaling on demand

**Vertical Scaling**:
- Database connection pooling
- Redis for shared state
- CDN for static assets

---

## Monitoring & Observability

### Metrics Tracked

- Request latency (p50, p95, p99)
- Error rates by endpoint
- Document processing time
- Chat response time
- Token usage per user
- API rate limit usage

### Alerting

**Critical Alerts**:
- Application crash
- Database connection failure
- Authentication service down
- API unavailable

**Warning Alerts**:
- Elevated error rates
- High latency (>2s p95)
- Near rate limits
- Low disk space

### Dashboards

- **Sentry**: Error tracking and analysis
- **Vercel**: Performance monitoring
- **Supabase**: Database metrics
- **Custom**: Uptime and health

---

## Deployment Architecture

### Production (Vercel)

```
Internet → Vercel Edge → Next.js Serverless Functions
                     ↓
              Database (Supabase)
                     ↓
              Cache (Upstash)
                     ↓
              External APIs (OpenAI)
```

### Disaster Recovery

- **Backup**: Automatic daily database backups
- **RTO**: 1 hour recovery time objective
- **RPO**: 24 hour recovery point objective
- **Rollback**: Automatic deployment rollback on errors

---

**Last Updated**: 2026-02-07  
**Version**: 1.0.0
