# Feature Landscape for AI Document Chat (RAG Pipeline)

**Domain:** Document-based Q&A with RAG pipeline
**Researched:** February 2025
**Confidence Level:** HIGH - Based on official Supabase, OpenAI, and Vercel documentation

---

## Executive Summary

Production RAG applications require a carefully balanced feature set that balances user experience, system performance, and operational complexity. This research categorizes features into three tiers: **Must-Have** (table stakes for any functional RAG app), **Should-Have** (production-critical features that differentiate quality implementations), and **Nice-to-Have** (user experience enhancements that improve adoption but aren't blockers).

The core finding from analyzing Supabase's production RAG implementation and OpenAI's embedding documentation is that **citation accuracy and access control are non-negotiable for enterprise deployment**. Your architecture choice of LangChain.js + Supabase + Vercel AI SDK is well-aligned with current best practices, particularly the use of pgvector for semantic search and Row Level Security for multi-tenant document access.

Key recommendations from this research:
- Implement hybrid search (semantic + keyword) for better recall than semantic-only
- Use HNSW indexes with configurable ef_search parameters for performance tuning
- Design chunking strategy to preserve citation accuracy (map chunks back to source locations)
- Plan for metadata filtering early to support future access control requirements

---

## Must-Have Features

Features users expect in any functional RAG application. Missing these features means the product feels incomplete or broken.

### 1. Document Upload and Processing

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| PDF/Document file upload | Users need to input source materials | Medium | Use LangChain.js PDFLoader with PyPDF or pdf-parse backend |
| Multi-format support (DOCX, TXT, MD) | Business documents come in various formats | Medium | LangChain.js supports multiple document loaders |
| Upload progress indication | Large files take time to process | Low | Frontend state management with progress callbacks |
| File size limits (typically 10-50MB) | Prevent resource exhaustion | Low | Server-side validation with clear error messages |
| Duplicate file detection | Prevent redundant storage and indexing | Low | Hash-based deduplication on upload |

**Implementation Detail:** The Supabase Headless Vector Search toolkit demonstrates the standard approach: upload → extract text → chunk → embed → store in pgvector. Your 500-token chunk size with 50-token overlap aligns with industry practice for general-purpose RAG.

**Citations Research Finding:** OpenAI's embedding documentation emphasizes that citation accuracy depends on preserving source-to-chunk mappings. Each chunk should store metadata linking back to its original source location (page number, file ID, position). This is critical for the "Answers grounded in actual document content with page references" requirement.

### 2. Text Chunking and Embedding

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| Recursive text splitting | Preserve semantic coherence across chunks | Medium | LangChain.js RecursiveCharacterTextSplitter with overlap |
| Configurable chunk size | Different document types need different chunking | Low | Default 500 tokens, allow tuning via configuration |
| Overlap between chunks | Maintain context across chunk boundaries | Low | 50-token overlap is standard practice |
| Vector embedding generation | Enable semantic similarity search | Medium | OpenAI text-embedding-3-small (1536 dimensions, cost-effective) |
| Embedding dimension control | Balance accuracy vs. storage/cost | Low | text-embedding-3-small supports 1536 default, reducible to 256-1024 |

**Research Validation:** OpenAI's embedding documentation confirms that `text-embedding-3-small` with 1536 dimensions provides 62.3% performance on MTEB evaluation at 62,500 pages per dollar—making it the cost-performance leader for general RAG use cases. Your choice aligns with best practices.

**Chunking Strategy Finding:** The Supabase documentation recommends storing chunk metadata (source file, page number, chunk sequence) to enable accurate citation. The `document_sections` table pattern with `document_id` and `content` columns is the recommended schema approach.

### 3. Semantic Search and Retrieval

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| Similarity search (cosine distance) | Core RAG retrieval mechanism | Low | pgvector `<=>` operator for cosine similarity |
| Configurable top-k results | Control response relevance vs. breadth | Low | Default 5 matches, configurable per-query |
| Similarity threshold filtering | Filter out irrelevant results | Low | Default 0.7 threshold (70% similarity) |
| pgvector storage and indexing | Enable fast vector similarity queries | Medium | HNSW index recommended for production |
| Metadata filtering | Support filtered searches (by document, date, etc.) | Medium | JSONB metadata column with PostgREST operators |

**Performance Research Finding:** Supabase's "Going to Production" guide emphasizes HNSW indexes over IVFFlat for production workloads due to better query performance and robustness against changing data. Key parameters: `m` (16-48, default 16), `ef_construction` (64-100, default 64), `ef_search` (40-100, default 40).

**Critical Finding:** Sequential scans (no index) are acceptable only for small datasets (<10,000 vectors). For production scale, you MUST implement HNSW indexing. The Supabase guide explicitly warns: "Sequential scans will result in significantly higher latencies and lower throughput, guaranteeing 100% accuracy and not being RAM bound."

### 4. Streaming AI Response Generation

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| Real-time streaming responses | Reduce perceived latency, improve UX | Medium | Vercel AI SDK `streamText` or `streamUI` |
| Streaming token-by-token display | Shows AI "thinking" process | Low | Frontend consume streaming response |
| Connection resilience | Handle network interruptions | Medium | Automatic reconnection with resume capability |
| Stop/interrupt streaming | User control over response generation | Low | AbortController integration |

**Research Finding:** Vercel AI SDK is designed specifically for this use case, providing unified streaming interfaces across model providers. The Supabase Headless Vector Search example demonstrates the standard pattern: Edge Function receives query → generates embedding → queries pgvector → streams response from OpenAI.

### 5. Source Citations and References

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| Inline citations in responses | Users verify AI answers against sources | Medium | Map retrieved chunks to citations in generated response |
| Source document identification | Show which document answered the question | Low | Display document name/title with each result |
| Page/section references | Precise location in source document | Medium | Extract page numbers during chunking |
| Clickable source links | Jump to source context | Low | Deep link to document viewer |
| Citation count in responses | Show how many sources informed the answer | Low | Metadata display in chat interface |

**Critical Research Finding:** This is your core differentiator ("Answers grounded in actual document content with page references"). The Supabase RAG with Permissions guide shows the table structure needed: `document_sections` table with `document_id` linking to `documents` table storing `owner_id` and `name`. Citation accuracy requires preserving this mapping through the chunk → embed → retrieve → generate pipeline.

### 6. Authentication and User Management

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| User registration/signup | Identity creation for multi-user features | Medium | Supabase Auth integration |
| User login/session management | Secure access to personal documents | Medium | JWT-based sessions with Supabase Auth |
| Password reset flow | Account recovery capability | Low | Supabase Auth built-in flows |
| Session timeout | Security for unattended sessions | Low | Configurable session expiration |

**Research Finding:** Supabase Auth integrates with RLS (Row Level Security) for document access control. The RAG with Permissions guide demonstrates how `auth.uid()` automatically filters document access in pgvector queries—this is essential for multi-tenant document storage.

---

## Should-Have Features

Features that significantly improve production readiness and user trust. Not strictly required for MVP but critical for real-world deployment.

### 1. Multi-Document Management

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|---------------------|
| Document library/organization | Users manage multiple documents | Medium | Folder/tag organization system |
| Document metadata (title, description, tags) | Organize and find documents | Low | Metadata columns in documents table |
| Bulk document operations | Efficient document management | Medium | Multi-select upload, delete, organize |
| Document version history | Track document changes over time | High | Version table with historical embeddings |
| Cross-document search | Query across multiple documents | Medium | Remove document_id filter in similarity search |

**Research Finding:** Supabase's "Engineering for Scale" guide recommends starting with single-database architecture but planning for multi-pod separation as data grows. The `document_sections` → `documents` table relationship supports cross-document querying by default (omit document_id filter).

**Citation Complexity Warning:** Cross-document search complicates citation accuracy. When a response draws from multiple documents, ensure citations clearly indicate which source each claim came from. Consider "Source A says X; Source B says Y" response patterns.

### 2. Conversation and Context Management

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|---------------------|
| Conversation history persistence | Users return to previous Q&A sessions | Medium | Store chat history in database |
| Conversation threading | Organize related questions | Medium | Parent-child message structure |
| Context-aware follow-up | AI remembers previous questions | Medium | Include conversation history in retrieval |
| Conversation search | Find past Q&A sessions | Medium | Text search on conversation titles/summaries |
| Conversation sharing | Collaborate on document Q&A | High | Shareable conversation links with permissions |

**Technical Finding:** Vercel AI SDK's `useChat` hook provides conversation state management out of the box. For persistence, design a `conversations` table with `user_id`, `document_id`, `title`, `created_at` and a `messages` table linking to conversations.

### 3. Enhanced Search Capabilities

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|---------------------|
| Hybrid search (semantic + keyword) | Better recall than semantic-only | Medium | Combine pgvector similarity with pg_fulltext |
| Reciprocal Rank Fusion (RRF) | Optimal result ranking from multiple search methods | Medium | Merge semantic and keyword results with RRF scoring |
| Re-rank API integration | Improve top-k result relevance | Medium | OpenAI rerank endpoint or Cohere Rerank API |
| Exact phrase matching | Find specific terminology | Low | PostgreSQL full-text search tsvector |
| Query expansion/synonyms | Handle synonyms and related terms | Medium | Embedding-based query expansion |

**Critical Research Finding:** Supabase's "Hybrid Search" documentation demonstrates that combining semantic and keyword search significantly improves recall. The hybrid_search function implements Reciprocal Rank Fusion (RRF) to merge results: "Hybrid search combines the strengths of both methods... It would ensure that recipes explicitly mentioning the keywords are prioritized, thus capturing direct hits that satisfy the keyword criteria. At the same time, it would include recipes identified through semantic understanding."

**Implementation Detail:** The Supabase hybrid search implementation uses configurable weights (`full_text_weight`, `semantic_weight`) allowing tuning between keyword and semantic relevance. Start with 50/50 weighting and adjust based on user feedback.

### 4. Access Control and Permissions

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|---------------------|
| Document-level permissions | Control who can access what | Medium | RLS policies on document_sections |
| Shared document access | Collaborate within teams | Medium | Many-to-many user-document access table |
| Organization/team workspaces | Team-based document management | High | Organization hierarchy with inherited permissions |
| Document visibility levels | Public, private, shared options | Medium | Visibility enum with RLS enforcement |
| Audit logging | Track document access for compliance | Medium | Access log table with user, action, timestamp |

**Critical Research Finding:** Supabase's "RAG with Permissions" guide provides the definitive pattern for production access control. The key insight: use Row Level Security (RLS) so that document access filtering happens at the database level, not in application code. This prevents accidental data leaks and scales to complex permission models.

**Implementation Pattern:**
```sql
-- Enable RLS on document sections
alter table document_sections enable row level security;

-- Create policy for document access
create policy "Users can query their own document sections"
on document_sections for select to authenticated using (
  document_id in (
    select id from documents
    where owner_id = auth.uid()
  )
);
```

### 5. Performance and Scalability

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|---------------------|
| Async document processing | Large files don't block uploads | Medium | Queue-based processing with status tracking |
| Processing status indicators | User knows when documents are ready | Low | Processing state with progress percentage |
| Query result caching | Faster repeated queries | Medium | Cache embeddings and search results |
| Database connection pooling | Handle concurrent queries | Low | Supabase connection pool configuration |
| Pagination for large result sets | Handle many matches efficiently | Low | Offset-based or cursor-based pagination |

**Performance Research Finding:** Supabase's "Going to Production" guide emphasizes pre-warming indexes and caching: "Execute 10,000 to 50,000 'warm-up' queries before each benchmark/prod. This will help to utilize cache and buffers more efficiently."

### 6. Error Handling and Reliability

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|------------------|------------|---------------------|
| Graceful degradation | Partial failures don't crash app | Medium | Fallback to smaller top-k, retry logic |
| Clear error messages | Users understand what went wrong | Low | User-friendly error states |
| Retry logic for API calls | Transient failures recover automatically | Medium | Exponential backoff for embedding/generation calls |
| Corruption detection | Invalid documents don't cause errors | Low | Hash verification on upload |
| Rate limiting | Prevent abuse of API quotas | Low | Token bucket or fixed window rate limiter |

**Critical Finding:** OpenAI API rate limits and costs require careful handling. Implement request queuing and user-facing cost estimates to prevent surprise bills.

---

## Nice-to-Have Features

Enhancements that improve user experience and differentiate the product but are deferrable to post-MVP phases.

### 1. User Experience Enhancements

| Feature | Value Proposition | Complexity | Defer Rationale |
|---------|------------------|------------|-----------------|
| Suggested follow-up questions | Guide users to deeper exploration | Medium | Requires query analysis, can be added later |
| Document preview/thumbnail | Quick document identification | Medium | Thumbnail generation service |
| Real-time collaboration | Multiple users on same document | High | WebSocket-based presence |
| Dark mode | Visual preference accommodation | Low | CSS theme switching |
| Keyboard shortcuts | Power user efficiency | Low | Event listener for key combinations |
| Mobile-responsive design | Access from any device | Medium | Responsive UI components |

### 2. Advanced AI Capabilities

| Feature | Value Proposition | Complexity | Defer Rationale |
|---------|------------------|------------|-----------------|
| Multi-turn clarification | AI asks follow-ups for ambiguous queries | High | Requires sophisticated intent classification |
| Document summarization | Generate summaries of uploaded documents | Medium | Separate summarization pipeline |
| Citation export (PDF/APA) | Academic/professional citation formatting | Medium | Citation formatting library integration |
| Custom prompt templates | Domain-specific response tuning | Medium | Prompt template management system |
| Voice input/query | Hands-free document interaction | High | Speech-to-text integration |
| Multi-language support | International document Q&A | Medium | Translation + multilingual embeddings |

### 3. Analytics and Insights

| Feature | Value Proposition | Complexity | Defer Rationale |
|---------|------------------|------------|-----------------|
| Query analytics dashboard | Understand user behavior | Medium | Analytics collection + visualization |
| Popular documents report | Track most-queried content | Low | Query count aggregation |
| User engagement metrics | Measure product adoption | Medium | Session tracking + event logging |
| Search quality metrics | Identify retrieval issues | High | Click-through and feedback collection |
| Cost tracking/budget alerts | Monitor API spending | Low | Usage metering with alerts |

### 4. Integration and Export

| Feature | Value Proposition | Complexity | Defer Rationale |
|---------|------------------|------------|-----------------|
| Conversation export (PDF/MD) | Save Q&A sessions for later | Medium | Export formatting library |
| API access for integrations | Build custom workflows | High | API key management + rate limiting |
| Webhook notifications | Integrate with external systems | Medium | Webhook delivery with retry logic |
| Third-party integrations | Connect with existing tools | High | OAuth + API integration per service |
| Embeddable widget | Put chat on external sites | High | Iframe or script embedding |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in RAG applications that cause user frustration or technical debt.

### 1. Over-Engineering the MVP

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Complex multi-stage retrieval pipelines | Increases latency and failure modes | Start with simple top-k retrieval |
| Custom embedding models | Training/maintenance overhead | Use text-embedding-3-small |
| Real-time web search integration | Complexity explosion, cost management | Defer to post-MVP |
| Agentic document processing | Overkill for Q&A use case | Simple chunk-and-retrieve |
| Fine-tuned LLMs for domain | High cost, limited benefit | Use prompt engineering instead |

**Research Finding:** Supabase's Headless Vector Search demonstrates the principle: "The toolkit consists of 2 parts: The Headless Vector Search template and A GitHub Action which will ingest your markdown files, convert them to embeddings, and store them in your database." Simple, focused, production-ready.

### 2. Poor Citation Design

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Generic "[1]" citations | Users can't verify sources | Include document name/page in each citation |
| Late citation binding | Citation accuracy issues | Build citations during retrieval, not generation |
| Unverifiable AI claims | Users distrust AI | Always show source excerpt alongside claim |
| Citation overload | Response readability suffers | Limit to top 3-5 most relevant sources |

### 3. Missing Error Handling

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Silent failures on upload | Users think documents were processed | Clear error states with retry options |
| Empty responses for unknown | Users don't understand why | "I couldn't find information about X in your documents" |
| No fallback for API failures | Complete app failure | Graceful degradation with cache |
| Unlimited file uploads | Storage/cost explosion | Tiered limits by plan |

---

## Feature Dependencies

```
MVP Core Dependencies:
Document Upload → Text Extraction → Chunking → Embedding → pgvector Storage
                                        ↓
Streaming Response ← Similarity Search ← Query Embedding
                                        ↓
                                Citation Binding

Should-Have Dependencies:
Conversation History requires: Database schema for messages
Hybrid Search requires: Full-text search tsvector columns
RLS Permissions requires: RLS policies on document_sections

Nice-to-Have Dependencies:
Suggested Questions requires: Query analysis pipeline
Document Summarization requires: Separate summarization LLM calls
Multi-language requires: Multilingual embedding model
```

---

## MVP Recommendation

For MVP, prioritize in this order:

### Phase 1: Core RAG (Must-Have)
1. PDF upload with LangChain.js PDFLoader
2. Text chunking with RecursiveCharacterTextSplitter (500 tokens, 50 overlap)
3. OpenAI text-embedding-3-small embeddings stored in pgvector
4. Cosine similarity search with top-k=5, threshold=0.7
5. Streaming responses via Vercel AI SDK
6. Source citations linking chunks to document/page
7. User authentication via Supabase Auth

### Phase 2: Production Hardening (Should-Have)
1. HNSW vector indexes for query performance
2. Conversation history persistence
3. Multi-document support with cross-document search
4. Basic RLS for document-level permissions
5. Error handling with graceful degradation
6. Processing status indicators

### Phase 3: Enhancement (Nice-to-Have)
1. Hybrid search with Reciprocal Rank Fusion
2. Suggested follow-up questions
3. Conversation export
4. Analytics dashboard

---

## Sources

### Primary Documentation
- **Supabase RAG with Permissions**: https://supabase.com/docs/guides/ai/rag-with-permissions - Row Level Security pattern for multi-tenant document access
- **Supabase Going to Production**: https://supabase.com/docs/guides/ai/going-to-prod - HNSW vs IVFFlat indexing, performance tuning
- **Supabase Semantic Search**: https://supabase.com/docs/guides/ai/semantic-search - Cosine similarity, inner product, pgvector operators
- **Supabase Hybrid Search**: https://supabase.com/docs/guides/ai/hybrid-search - Reciprocal Rank Fusion combining semantic + keyword search
- **Supabase LangChain Integration**: https://supabase.com/docs/guides/ai/langchain - SupabaseVectorStore usage patterns
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings - text-embedding-3-small specifications, dimensions, similarity metrics

### Implementation References
- **Supabase Headless Vector Search**: https://github.com/supabase/headless-vector-search - Production RAG implementation template
- **Supabase Engineering for Scale**: https://supabase.com/docs/guides/ai/engineering-for-scale - Multi-database architecture patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Must-Have Features | HIGH | Based on official Supabase and OpenAI documentation |
| Should-Have Features | HIGH | Production hardening requirements from Supabase guides |
| Citation Implementation | HIGH | Supabase RAG patterns validated for accuracy |
| Search Strategy | HIGH | Hybrid search + HNSW indexes documented thoroughly |
| Access Control | HIGH | RLS patterns from Supabase are production-proven |
| Nice-to-Have Features | MEDIUM | Best practices but dependent on user feedback |
