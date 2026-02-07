# Project Roadmap: AI Document Chat

**Version:** 1.0  
**Created:** February 2025  
**Status:** Draft - Pending Approval

---

## Milestone: MVP

This roadmap outlines the development phases for building an AI-powered document chat application that enables users to upload PDF documents and engage in contextual conversations with precise source citations. The system leverages Retrieval-Augmented Generation (RAG) to ensure all responses are grounded in actual document content, providing verifiable answers suitable for professional portfolio demonstration.

The MVP focuses on core functionality that demonstrates technical competence in modern AI/ML stacks while maintaining architectural soundness for future expansion. Every feature in this roadmap directly supports the core value proposition: helping users extract insights from their documents with AI-powered conversational search.

---

## Phase Structure Overview

The following table provides a high-level view of the development phases, their goals, success criteria, and key requirements. Each phase builds upon the previous, creating a coherent delivery path from foundation to full user experience.

| Phase | Name | Goal | Success Criteria | Key Requirements |
|-------|------|------|-------------------|------------------|
| 1 | Foundation | Set up authentication, database schema, storage infrastructure, and security policies | Users can sign up and log in securely; documents stored in private buckets with proper access controls | Supabase Auth, PostgreSQL schema, Row Level Security policies, Storage buckets, Environment configuration |
| 2 | Document Ingestion | Implement complete document processing pipeline from upload to searchable embeddings | PDFs uploaded by users are parsed, chunked semantically, and converted to vectors within 30 seconds | LangChain.js PDF loaders, RecursiveCharacterTextSplitter, OpenAI embedding API, Batch embedding operations |
| 3 | Retrieval Infrastructure | Build query processing and semantic similarity search system | User queries return top-5 relevant document chunks with cosine similarity above 0.7 threshold within 2 seconds | pgvector similarity search, HNSW indexes, Query embedding generation, Result filtering |
| 4 | Chat Interface | Deliver complete conversational AI experience with streaming responses and citations | Users engage in multi-turn conversations receiving streaming AI responses with inline source citations | Vercel AI SDK streaming, Citation binding logic, Conversation history storage, Context window management |

---

## Phase Details

### Phase 1: Foundation

**Goal:** Establish secure authentication, robust database schema, and proper infrastructure for document storage and access control.

**Success Criteria:**

1. Users can create accounts using email/password and authenticate via Supabase Auth with JWT session management
2. Authenticated users can only access their own documents and conversation data through Row Level Security policies
3. Document storage buckets are configured with proper CORS settings and private access by default
4. Database schema supports users, documents, conversations, messages, and citations with proper foreign key relationships
5. Environment variables are properly configured and validated at application startup
6. Error handling provides user-friendly messages without exposing system details

**Key Tasks:**

1. Initialize Next.js 14+ project with TypeScript and App Router structure
2. Configure Supabase project with Authentication enabled (Email/Password provider)
3. Design and execute PostgreSQL schema for users, documents, conversations, messages, and citations
4. Implement Row Level Security policies ensuring data isolation between users
5. Create Supabase Storage buckets for document uploads with private access controls
6. Build authentication context and hooks (useAuth, signIn, signOut, signUp)
7. Create protected route wrapper component for authenticated pages
8. Implement environment validation to catch misconfiguration early
9. Set up API route structure following Next.js 14 conventions
10. Configure database connection pooling and optimization settings

**Dependencies:** None - This is the starting phase

**Pitfall Mitigations:**

- **Security (RLS):** Every table includes RLS policies blocking cross-user access; policies tested with multiple user accounts during development
- **Configuration Errors:** Environment validation script runs at build time and startup to catch missing or invalid values
- **Database Performance:** Proper indexes on user_id and created_at columns for efficient queries; connection pooling configured for serverless environment

**Risks:**

- **Supabase Auth Configuration:** Risk of misconfigured redirect URLs causing login failures. Mitigation: Document all required URLs during setup and test login flow thoroughly before proceeding
- **Schema Complexity:** Risk of schema changes mid-project causing migration issues. Mitigation: Use Supabase migrations from start and test all migrations in staging environment
- **RLS Policy Errors:** Risk of overly restrictive policies blocking legitimate access. Mitigation: Test policies with multiple user scenarios before phase completion

**Estimated Effort:** Medium - Requires careful attention to security but uses well-documented Supabase patterns

---

### Phase 2: Document Ingestion

**Goal:** Implement complete document processing pipeline that transforms uploaded PDFs into semantically searchable vector representations.

**Success Criteria:**

1. Users can upload PDF documents up to 50MB through a responsive upload interface with progress indication
2. Uploaded PDFs are parsed using LangChain.js PDFLoader extracting text content within 10 seconds
3. Extracted text is chunked using RecursiveCharacterTextSplitter with 500-token chunks and 50-token overlap
4. Text chunks are converted to OpenAI text-embedding-3-small vectors in batches with proper error handling
5. Embeddings are stored in Supabase pgvector with document and chunk metadata within 30 seconds total
6. Failed uploads display clear error messages and allow retry without data corruption
7. Duplicate document uploads are detected and handled gracefully (skip or overwrite option)
8. Multi-document uploads process sequentially with individual success/failure status

**Key Tasks:**

1. Install and configure LangChain.js with PDFLoader and RecursiveCharacterTextSplitter
2. Build document upload API route with file validation (PDF only, size limits)
3. Implement PDF text extraction with error handling for malformed files
4. Create text chunking pipeline with configurable chunk size and overlap parameters
5. Integrate OpenAI embedding API with text-embedding-3-small model
6. Implement batch embedding generation to optimize API usage and rate limits
7. Design pgvector schema for storing embeddings with document_id, chunk_index, and metadata
8. Build embedding storage API with proper transaction handling
9. Create upload progress tracking via Supabase realtime subscriptions or polling
10. Implement document deletion with cascade to associated chunks and conversations
11. Add document listing interface showing upload date, chunk count, and status

**Dependencies:**

- Phase 1 complete (Authentication required for upload)
- Supabase Storage bucket configured
- Database schema with documents and chunks tables

**Pitfall Mitigations:**

- **Rate Limiting:** Implement exponential backoff for embedding API calls; batch chunks to minimize API calls; add circuit breaker pattern for sustained failures
- **Retrieval Quality (Chunking):** Use RecursiveCharacterTextSplitter with appropriate separators (newlines, sentences, phrases) to maintain semantic coherence; 50-token overlap prevents context boundaries from splitting related content
- **Processing Failures:** Wrap entire ingestion pipeline in try-catch with transaction semantics; partial failures can be retried; corrupted documents quarantined with clear error messages
- **Large Document Handling:** Stream processing for large PDFs to avoid memory exhaustion; chunk documents incrementally rather than loading entire file

**Risks:**

- **PDF Parsing Quality:** Risk of poor text extraction from scanned PDFs. Mitigation: Add OCR option for Phase 2.5 if needed; warn users about scanned document limitations
- **Embedding Costs:** Risk of unexpected OpenAI API costs. Mitigation: Implement usage tracking and cost alerts; use smallest effective batch sizes; cache embeddings to avoid reprocessing
- **Processing Timeouts:** Risk of serverless function timeouts on large documents. Mitigation: Use background processing with status tracking; implement chunk-by-chunk processing with checkpoints

**Estimated Effort:** High - Complex multi-step pipeline with external API dependencies and error scenarios

---

### Phase 3: Retrieval Infrastructure

**Goal:** Build efficient semantic search system that returns relevant document chunks for user queries with configurable similarity thresholds.

**Success Criteria:**

1. User queries are converted to embeddings using text-embedding-3-small within 1 second
2. pgvector similarity search returns top-5 chunks with cosine similarity above 0.7 threshold
3. Query latency P95 remains under 2 seconds for typical document collections
4. Search results include document name, chunk content, page numbers, and similarity score
5. Multi-document queries aggregate results from all user documents with relevance ranking
6. Empty result sets return helpful messages suggesting query reformulation
7. Search results exclude chunks below threshold rather than returning irrelevant content
8. System handles concurrent queries without degradation in latency

**Key Tasks:**

1. Create embedding generation API for query processing
2. Implement pgvector similarity search with cosine distance calculation
3. Design and create HNSW indexes on embedding vectors for performance optimization
4. Build query routing to search across all user documents by default
5. Implement configurable top-k and threshold parameters with safe defaults
6. Create result formatting with document metadata and source attribution
7. Add query preprocessing (lowercase, whitespace normalization) for consistency
8. Implement result caching for repeated identical queries
9. Build search API with proper error handling and fallback behavior
10. Add query logging for analytics and quality monitoring
11. Create admin/debug interface for viewing search results and scores

**Dependencies:**

- Phase 2 complete (Documents with embeddings exist for search)
- pgvector extension enabled and functional
- Embedding generation API available

**Pitfall Mitigations:**

- **Retrieval Quality (Hybrid Search):** While full hybrid search deferred to v2, implement basic keyword filtering on results to catch semantic misses; allow users to filter by specific documents
- **Hallucination Prevention (Retrieval):** Low-similarity results filtered out before reaching LLM; retrieval failures trigger explicit "no relevant information found" rather than guessing
- **Latency:** HNSW indexes provide logarithmic search time; embedding generation optimized with connection pooling; caching for repeated patterns
- **Empty Results:** Clear user feedback when no chunks meet threshold; suggestions for query reformulation; never return "no results found" without explanation

**Risks:**

- **HNSW Index Performance:** Risk of incorrect index configuration causing slow queries. Mitigation: Follow pgvector HNSW best practices; test with progressively larger datasets; monitor query times during development
- **Threshold Tuning:** Risk of 0.7 threshold being too strict or too loose. Mitigation: Log similarity distributions to inform tuning; make threshold configurable per query; provide UI controls for advanced users
- **Concurrent Load:** Risk of many simultaneous queries overwhelming embedding API. Mitigation: Rate limiting per user; request queuing for bursts; horizontal scaling readiness

**Estimated Effort:** Medium - Focused implementation with clear success metrics but requires performance tuning

---

### Phase 4: Chat Interface

**Goal:** Deliver complete conversational AI experience with streaming responses, source citations, and multi-turn context management.

**Success Criteria:**

1. Users can send messages and receive streaming AI responses within 3 seconds of sending
2. Responses include inline citations referencing source chunks with clickable links to document locations
3. Conversation history persists across sessions with full message and citation data
4. Multi-turn conversations maintain context from previous messages within token limits
5. Chat interface displays loading states, streaming progress, and error recovery options
6. Users can start new conversations and switch between existing conversations
7. Token usage statistics are displayed for each response (input/output token counts)
8. Rate limiting provides graceful degradation rather than hard failures
9. Mobile-responsive interface works on desktop and mobile devices

**Key Tasks:**

1. Configure Vercel AI SDK with OpenAI GPT-4o model
2. Implement chat API route with retrieval-augmented generation prompt
3. Build streaming response handling with proper chunk parsing
4. Design citation binding system to inject source references into AI responses
5. Create conversation storage (messages with role, content, citations)
6. Implement context window management to stay within model limits
7. Build chat UI with message list, input area, and source citation panel
8. Add streaming indicators and progress feedback during response generation
9. Implement retry functionality for failed requests
10. Create conversation list interface with search and filtering
11. Add token usage tracking and display
12. Implement rate limiting with user-friendly error messages
13. Test multi-turn conversation continuity across context windows

**Dependencies:**

- Phase 3 complete (Retrieval system available for context augmentation)
- Phase 1 complete (Authentication required for conversation storage)
- OpenAI API access with GPT-4o and embedding models

**Pitfall Mitigations:**

- **Hallucination Prevention:** System prompts explicitly instruct model to only use provided context; citation enforcement through prompt engineering; model calibrated to say "I don't know" rather than fabricate
- **Rate Limiting:** Exponential backoff with jitter for API calls; graceful degradation showing cached responses when available; clear rate limit messages with retry timing
- **Citation Accuracy:** Citations extracted from retrieved chunks, not generated; clickable citations link to verified source locations; citation format includes document name and chunk identifier
- **Context Management:** Sliding window approach keeps recent context; token counting before API calls to prevent overflow; system messages clearly delineate between user queries and context

**Risks:**

- **Token Costs:** Risk of high OpenAI API costs from verbose conversations. Mitigation: Implement token tracking dashboard; context summarization for long conversations; hard limits on context window per conversation
- **Streaming Reliability:** Risk of stream interruptions corrupting responses. Mitigation: Robust stream parsing with error recovery; partial response caching; automatic retry with exponential backoff
- **Citation Formatting:** Risk of AI modifying citation format or omitting citations. Mitigation: Citation enforcement through few-shot examples; post-processing to validate citations; penalty in prompt for uncited claims

**Estimated Effort:** High - Complex integration requiring careful coordination between multiple systems

---

## Cross-Phase Integration

### How Phases Connect End-to-End

The four phases form a pipeline where each phase enables the next while maintaining independence for development and testing. This structure allows parallel work where possible while ensuring dependencies are respected.

Phase 1 provides the security foundation that all subsequent phases require. Without authenticated users and proper access controls, no document or conversation data can exist. The database schema designed in Phase 1 directly supports the document storage of Phase 2 and the conversation storage of Phase 4.

Phase 2 creates the searchable knowledge base that Phases 3 and 4 depend upon. The chunking and embedding pipeline produces the vector data that retrieval queries access. Testing in Phase 2 uses synthetic queries against embedded documents to verify the pipeline produces searchable content.

Phase 3 creates the query-to-context bridge that transforms user questions into relevant document passages. This phase can be tested independently using the embedded documents from Phase 2, allowing retrieval quality to be validated before building the chat interface.

Phase 4 integrates retrieval with generation to produce the complete user experience. The chat interface depends on all previous phases working correctly, so comprehensive testing of Phase 3 is essential before beginning Phase 4 implementation.

### Data Flow Across Phases

User authentication data flows from Phase 1 through all subsequent phases, with every database query and storage operation filtered by the authenticated user ID. This ensures complete data isolation as a fundamental property of the system.

Document flow begins with user upload in Phase 2, progressing through extraction, chunking, embedding, and storage. The resulting document chunks with their embeddings become the searchable knowledge base. Metadata including document names, chunk positions, and processing status remains available for display and filtering.

Query flow begins in Phase 4 with user input, travels through Phase 3 for embedding and retrieval, returns relevant chunks to Phase 4, and finally reaches the LLM for response generation. The complete flow executes in milliseconds for real-time responsiveness.

Conversation flow maintains message history in Phase 4 storage, with each message including content, role, citations, and token counts. When users continue conversations, previous messages augment retrieval results as context for the AI response.

### Testing Strategy Across Phases

Phase 1 testing focuses on security and data isolation. Authentication flows are tested with multiple scenarios including sign-up, sign-in, password reset, and session expiration. RLS policies are verified by attempting cross-user access from authenticated sessions.

Phase 2 testing validates processing correctness and failure handling. Test documents of varying sizes and complexities verify chunking produces coherent segments. Embedding generation is verified by checking vector dimensions and storing known test vectors for comparison. Error scenarios including malformed PDFs and API failures are exercised.

Phase 3 testing measures retrieval quality and performance. A set of known queries with expected results validates retrieval accuracy. Performance testing with progressively larger document collections ensures latency remains acceptable. Threshold tuning uses logged similarity distributions to verify the 0.7 cutoff appropriately filters irrelevant results.

Phase 4 testing validates the complete user experience. End-to-end tests execute full chat flows from message to streaming response. Citation accuracy is verified by checking that cited sources actually support the claimed content. Multi-turn conversations are tested for context preservation and relevance. Performance testing confirms streaming responses begin within SLA requirements.

---

## Out of Scope

The following features are valuable but deferred to version 2 or future optimization phases. This focus ensures the MVP delivers core functionality with quality rather than attempting too many features with diluted effort.

**Hybrid Search (Deferred to Optimization Phase):** Combining semantic and keyword search improves recall for queries containing specific terminology. Implementation requires additional indexing infrastructure and query processing. This deferral allows the MVP to validate semantic retrieval effectiveness before investing in hybrid capabilities.

**PII Detection and Sanitization (Deferred to Security Phase):** Automatically detecting and redacting personally identifiable information from uploaded documents protects user privacy. While important, this requires careful implementation to avoid false positives that corrupt document content. Deferred until after MVP validates document processing pipeline stability.

**Conversation Export:** Downloading chat histories as PDF or Markdown for external reference. Users can capture conversations through browser features during the MVP phase.

**Document Preview:** In-browser PDF rendering showing document context alongside chat. Requires additional UI complexity and PDF.js integration. Users can open original documents in separate tabs during MVP.

**Suggested Follow-Up Questions:** AI-generated question suggestions based on conversation context encourage exploration. Deferred until after core chat functionality validates user engagement patterns.

**Token Usage Display:** Real-time token counting and cost estimates during conversation. Deferred to Phase 4.1 following MVP completion.

**Mobile Application:** Native iOS/Android apps for document chat on mobile devices. Web interface provides mobile access during MVP; native apps considered post-MVP based on user demand.

---

## Success Metrics

The following metrics define MVP success and will be tracked throughout development to guide priorities and validate progress.

### Document Processing Throughput

Target: 95% of documents under 10MB complete processing within 30 seconds  
Measurement: Timestamp difference between upload completion and searchable status  
Rationale: Users expect near-instant feedback when uploading documents; processing delays reduce perceived system responsiveness

### Query Latency (P95)

Target: 95th percentile of queries complete within 2 seconds  
Measurement: Time from user message submission to first streaming token  
Rationale: Interactive systems require sub-second response perception; 2 seconds provides headroom for retrieval while maintaining engagement

### Citation Accuracy

Target: 90% of citations reference chunks containing claimed information  
Measurement: Manual review sampling of citations with verification against source chunks  
Rationale: Citations are core value proposition; inaccurate citations undermine trust and usefulness

### User Satisfaction Indicators

Target: Net Promoter Score above 50 post-launch  
Measurement: In-app survey after first conversation completion  
Rationale: NPS provides actionable feedback for prioritization; targets portfolio-worthy demonstration quality

### System Reliability

Target: 99% uptime during business hours  
Measurement: Automated monitoring of API endpoint availability  
Rationala: Portfolio demo must be reliably available; instability creates negative impression

### Security Posture

Target: Zero data access violations between users  
Measurement: Automated testing of RLS policies with multiple user accounts  
Rationale: Security failures are catastrophic for trust; rigorous testing prevents embarrassing vulnerabilities

---

## Phase Summary Table

| Phase | Name | Focus | Duration | Dependencies | Key Risks |
|-------|------|-------|----------|--------------|-----------|
| 1 | Foundation | Authentication, Database, Storage | 1-2 weeks | None | RLS policy misconfiguration, Auth flow errors |
| 2 | Document Ingestion | PDF Processing, Chunking, Embedding | 2-3 weeks | Phase 1 | Rate limiting, Processing timeouts, Parsing quality |
| 3 | Retrieval Infrastructure | Similarity Search, Performance | 1-2 weeks | Phase 2 | Index performance, Threshold tuning, Latency under load |
| 4 | Chat Interface | Streaming AI, Citations, History | 2-3 weeks | Phase 3 | Hallucination, Token costs, Citation accuracy |

---

## Next Steps

Upon roadmap approval, execution proceeds phase-by-phase with `/gsd-plan-phase` commands to decompose each phase into specific implementation tasks. The roadmap serves as the master plan, while individual phase plans detail day-to-day work items.

**Immediate Actions:**
1. Review and approve roadmap structure
2. Begin Phase 1 planning with `/gsd-plan-phase 1`
3. Set up development environment following Phase 1 specifications

**Milestone Checkpoints:**
- Phase 1 completion: Authenticated users with isolated data
- Phase 2 completion: Uploaded documents become searchable
- Phase 3 completion: Queries return relevant sources
- Phase 4 completion: Full chat experience with citations
- MVP launch: All phases complete with success metrics validated

---

*This roadmap follows GSD (Get Shit Done) methodology with goal-backward success criteria and observable outcomes. Every requirement maps to exactly one phase. Every phase has verifiable success criteria.*