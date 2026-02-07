# Architecture Patterns for AI Document Chat (RAG Pipeline)

**Project:** AI Document Chat Application
**Research Date:** February 7, 2026
**Architecture Confidence:** HIGH

## Executive Summary

This architecture document provides validated patterns and implementation recommendations for building a production-ready RAG (Retrieval-Augmented Generation) pipeline for document chat applications. The architecture addresses the six critical research questions surrounding document processing scalability, embedding operations, cost management, and conversation state persistence. The recommended patterns leverage the existing Next.js 14 App Router foundation with Supabase as the unified backend for database, authentication, and vector storage operations.

The core architecture follows a three-tier pipeline model where document ingestion, query processing, and response generation operate as distinct stages with well-defined boundaries. This separation enables independent scaling of each component based on workload characteristics while maintaining data consistency through transactional boundaries. The architecture emphasizes server-side processing for computationally intensive operations like embedding generation while leveraging client-side streaming for responsive user experiences.

Production deployment considerations indicate that the current architecture using pgvector with cosine similarity search provides a solid foundation, but several patterns should be added or modified to address large document handling, cost optimization at scale, and multi-session conversation management. The recommendations in this document are validated against established practices from the RAG ecosystem and aligned with the current technology stack comprising Next.js 14, Supabase, and OpenAI's embedding and chat completion models.

## System Architecture Overview

### High-Level Component Architecture

The RAG pipeline architecture consists of six primary components that work together to transform uploaded documents into a queryable knowledge base and respond to user questions with contextually relevant answers. Each component has specific responsibilities and interfaces with neighboring components through well-defined contracts that enable independent evolution and optimization.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Client Layer (Next.js)                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                          │
│  │   Upload Interface  │    │  Chat Interface     │                          │
│  │   (React Components)│    │  (Streaming)        │                          │
│  └──────────┬──────────┘    └──────────┬──────────┘                          │
└─────────────┼─────────────────────────────┼──────────────────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     API Gateway (Next.js Route Handlers)                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     Request Processing Layer                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │  /upload    │  │  /documents │  │  /chat      │  │  /sessions  │    │ │
│  │  │  endpoint   │  │  endpoint   │  │  endpoint   │  │  endpoint   │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
              │
              │ (HTTPS/Stream)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Document Processing Service                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        Ingestion Pipeline                                 │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │ │
│  │  │   Parser    │───▶│   Chunker   │───▶│   Embedder  │───▶│  Storage  │ │ │
│  │  │             │    │             │    │             │    │  Service  │ │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └───────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
              │
              │ (PostgreSQL/Supabase)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Data Layer (Supabase)                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │   Document Store    │  │   Vector Store     │  │   Session Store    │   │
│  │   (raw content)     │  │   (pgvector)       │  │   (conversations)  │   │
│  │   · documents       │  │   · embeddings     │  │   · messages       │   │
│  │   · metadata        │  │   · chunks         │  │   · context        │   │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
              │
              │ (API Calls)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       External AI Services                                    │
│  ┌─────────────────────┐  ┌─────────────────────┐                            │
│  │   OpenAI Embeddings │  │   GPT-4o Chat      │                            │
│  │   (text-embedding-3)│  │   (completion)      │                            │
│  └─────────────────────┘  └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

The client layer handles user interactions through two primary interfaces: document upload for knowledge base construction and chat interaction for question answering. The upload interface manages file selection, progress tracking, and error feedback, while the chat interface provides real-time streaming responses with citation highlighting. Both interfaces communicate with Next.js API routes that serve as the application's API gateway, handling authentication, request validation, and routing to appropriate services.

The document processing service orchestrates the ingestion pipeline, managing the transformation from raw files to stored embeddings. This service is designed for server-side execution, leveraging Node.js runtime capabilities for file handling and HTTP communication with external APIs. The service implements retry logic, progress reporting, and error recovery to ensure reliable document processing even for large files with complex content structures.

The data layer provided by Supabase consolidates multiple storage concerns into a single database platform. Document storage maintains the original file content and extracted text along with metadata like processing status and creation timestamps. The pgvector extension enables efficient similarity search over embedding vectors, providing the core retrieval capability for the RAG pipeline. Session storage maintains conversation history and context across multiple chat sessions, enabling persistent dialogs that users can resume over time.

External AI services are accessed through their official APIs, with OpenAI providing both embedding generation and chat completion capabilities. The architecture assumes these services are accessed over HTTPS with appropriate API key management through environment variables. Rate limiting and cost tracking should be implemented at the service layer to prevent runaway costs and ensure fair resource allocation across users.

### Data Flow Architecture

Understanding how data moves through the system is essential for optimizing performance and debugging issues. The architecture implements two distinct data flows: one for document ingestion and another for query processing. Each flow has different performance characteristics and resource requirements that inform infrastructure decisions.

**Document Ingestion Data Flow:**

The ingestion flow begins when a user uploads a document through the client interface. The document is transmitted to the upload endpoint where it undergoes initial validation to confirm file type, size constraints, and content accessibility. Valid documents are stored in the document store with a pending processing status, establishing a record that can be referenced throughout the ingestion lifecycle.

The parsing stage extracts text content from the uploaded file using appropriate extractors based on file type. For PDF documents, this involves specialized parsing libraries that handle text extraction from both natively digital PDFs and scanned documents through OCR integration. The extracted text is validated for quality and completeness, with error handling for files that cannot be processed successfully.

Text chunking follows parsing, dividing the extracted content into overlapping segments that balance context preservation with query specificity. The current configuration using RecursiveCharacterTextSplitter with 500-token chunks and 50-token overlap represents a reasonable default, though optimal chunk sizes may vary by document type and query patterns. Chunk metadata tracks source location enabling citation generation in responses.

Embedding generation converts each chunk into a high-dimensional vector representation using OpenAI's text-embedding-3-small model. This stage is computationally expensive and rate-limited by the external API, requiring batch processing and retry logic for reliable operation. Generated embeddings are stored alongside chunk metadata in the vector store, indexed for similarity search operations.

**Query Processing Data Flow:**

The query flow initiates when a user submits a question through the chat interface. The question is first processed to extract the core query intent, potentially applying query rewriting or expansion techniques to improve retrieval precision. This preprocessing stage can incorporate conversation context from previous messages in the session.

Embedding generation for the query produces a vector representation using the same embedding model employed for document chunks, ensuring semantic compatibility during similarity comparison. The query embedding is submitted to the vector store for similarity search against stored document chunks.

The similarity search operation retrieves the top-k most relevant chunks based on cosine similarity, applying the configured threshold of 0.7 to filter out marginally relevant results. Retrieved chunks are ranked and selected to construct the context window for the language model, balancing comprehensiveness with token economy.

Context construction assembles the retrieved content into a prompt that includes system instructions, conversation history, relevant document chunks, and the current query. This assembled prompt is submitted to GPT-4o for completion generation, with streaming enabled for progressive response delivery.

The streaming response is transmitted to the client where it is displayed progressively as tokens arrive. Client-side rendering handles the streaming updates, maintaining a coherent conversational display. Citations are extracted from the retrieved chunks and displayed alongside referenced content, enabling users to trace answers back to source documents.

## Large Document Processing Patterns

### Challenge Analysis

Processing documents exceeding 100 megabytes presents significant architectural challenges that extend beyond simple scaling of existing pipelines. Large documents typically contain hundreds or thousands of pages, potentially millions of tokens, and may include complex structures like embedded images, tables, and multi-column layouts. The computational requirements for parsing, chunking, and embedding such documents can exceed time limits on serverless platforms, consume substantial API rate limits, and generate embedding costs that warrant careful optimization.

The streaming nature of modern web applications conflicts with the batch processing requirements of large document ingestion. Users expect reasonable feedback during upload and processing, but generating embeddings for a 500-page document could require hundreds of API calls spanning many minutes. Without proper architecture, users may experience timeout errors, see no progress indication, or encounter partial processing states that leave the system in an inconsistent condition.

Memory constraints on serverless platforms like Vercel functions add another dimension to the challenge. Processing a large PDF entirely in memory before chunking can exhaust available memory and cause function termination. Similarly, loading a 100MB document into memory for embedding generation would exceed typical memory limits even before considering the memory required for the embedding model inference.

### Streaming Chunk Processing Architecture

The recommended pattern for large document processing implements a streaming architecture where document content is processed incrementally rather than loaded entirely into memory. This approach maintains constant memory usage regardless of document size, provides progressive progress feedback to users, and enables early error detection before full document processing completes.

The streaming chunk processor reads document content in chunks from the source file, processes each chunk immediately, and discards intermediate results after embedding generation completes. This pipeline pattern maintains bounded memory consumption while enabling parallel processing of independent chunks. The implementation requires careful coordination to handle dependencies between chunks, particularly for maintaining overlap regions that span chunk boundaries.

```typescript
interface StreamingChunkProcessorConfig {
  chunkSize: number;
  overlapTokens: number;
  embeddingBatchSize: number;
  maxConcurrentEmbeddings: number;
  progressCallback: (processed: number, total: number) => void;
}

async function processLargeDocument(
  fileStream: ReadableStream<Uint8Array>,
  config: StreamingChunkProcessorConfig
): Promise<DocumentProcessingResult> {
  const textExtractor = createStreamingTextExtractor(fileStream.type);
  const chunkBuffer = new ChunkBuffer({
    size: config.chunkSize,
    overlap: config.overlapTokens
  });
  const embedder = new BatchEmbedder({
    batchSize: config.embeddingBatchSize,
    maxConcurrency: config.maxConcurrentEmbeddings
  });

  let processedChunks = 0;
  let totalChunksEstimate = 0;

  for await (const textChunk of textExtractor) {
    const newChunks = chunkBuffer.add(textChunk);
    totalChunksEstimate = chunkBuffer.estimatedTotalChunks;

    for (const chunk of newChunks) {
      const embeddings = await embedder.embed(chunk.content);
      await storeChunkWithEmbedding(chunk, embeddings[0]);
      
      processedChunks++;
      config.progressCallback(processedChunks, totalChunksEstimate);
    }
  }

  // Process remaining buffered chunks
  const remainingChunks = chunkBuffer.flush();
  for (const chunk of remainingChunks) {
    const embeddings = await embedder.embed(chunk.content);
    await storeChunkWithEmbedding(chunk, embeddings[0]);
  }

  return { totalChunks: processedChunks + remainingChunks.length };
}
```

The ChunkBuffer implementation maintains sliding window semantics across the document, preserving context across chunk boundaries through the overlap mechanism. When new text is added, the buffer emits chunks that include the overlap region from the previous chunk's end, ensuring semantic continuity in the embedded representations. The flush operation at document end generates final chunks without requiring overlap.

### Parallel Processing and Rate Limiting

Large document processing benefits from parallel embedding generation, but external API rate limits constrain the achievable parallelism. The architecture should implement a rate-limited batch processor that manages concurrent embedding requests while respecting OpenAI's rate limits. This requires tracking token usage across requests and implementing backoff logic for rate limit responses.

The optimal batch size balances throughput against latency and rate limit headroom. For text-embedding-3-small, OpenAI's rate limits typically allow several hundred requests per minute for most accounts, but actual limits vary by tier. The architecture should implement adaptive rate limiting that starts conservatively and adjusts based on observed response headers, providing stable throughput without hitting limits.

```typescript
class RateLimitedEmbedder {
  private requestQueue: Array<() => Promise<EmbeddingResult>> = [];
  private tokensPerMinute: number;
  private usedTokensThisMinute: number = 0;
  private resetTime: Date;

  constructor(options: RateLimitConfig) {
    this.tokensPerMinute = options.tokensPerMinute;
    this.resetTime = new Date();
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      await this.waitForRateLimit();
      
      const embedding = await this.callEmbeddingAPI(text);
      results.push(embedding);
      
      this.usedTokensThisMinute += embedding.tokens;
    }

    return results;
  }

  private async waitForRateLimit(): Promise<void> {
    if (this.usedTokensThisMinute >= this.tokensPerMinute) {
      const waitTime = this.resetTime.getTime() - Date.now();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.usedTokensThisMinute = 0;
      this.resetTime = new Date(Date.now() + 60000);
    }
  }
}
```

Progress tracking for large documents requires an adaptive estimation approach since the total chunk count depends on document structure and cannot be determined before parsing completes. The architecture should implement progressive estimation that starts with a rough guess based on file size and refines the estimate as parsing reveals actual content characteristics. Users receive continuous progress updates even when estimates are uncertain, with clear indication of estimation confidence.

### Asynchronous Processing Pattern

For documents exceeding platform time limits, asynchronous processing provides the most reliable architecture. The user uploads the document and receives immediate acknowledgment with a processing ticket. The actual processing occurs in background jobs that update the document status as they progress. Users can poll for status, receive webhook notifications, or view a processing dashboard to monitor progress.

The asynchronous architecture requires persistent state management to track processing status across job failures, server restarts, and extended processing times. Supabase provides the foundation for this state management through dedicated tables for processing jobs, chunk status tracking, and error logs. Each document processing job maintains its state in the database, enabling recovery from any failure point without losing progress.

```sql
CREATE TABLE document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  status PROCESSING_STATUS NOT NULL DEFAULT 'pending',
  total_chunks INTEGER,
  processed_chunks INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE chunk_processing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES document_processing_jobs(id),
  chunk_sequence INTEGER NOT NULL,
  chunk_content TEXT,
  embedding_vector VECTOR(1536),
  status CHUNK_STATUS DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ
);

ENUM PROCESSING_STATUS = ('pending', 'processing', 'completed', 'failed', 'cancelled');
ENUM CHUNK_STATUS = ('pending', 'processing', 'completed', 'failed');
```

The background job processor should implement checkpointing to record progress after each chunk or batch of chunks. This enables resumption from the last successful checkpoint rather than restarting entire documents on failure. The checkpoint interval balances write overhead against recovery time, with typical values ranging from 10 to 100 chunks depending on average chunk size and processing time.

## Chunking Strategy Analysis

### Server-Side Chunking Advantages

Server-side chunking provides the optimal approach for production RAG applications due to its consistent performance characteristics, better resource utilization, and improved security posture. All chunking logic executes in the controlled server environment where performance can be monitored, optimized, and scaled independently of client capabilities. This separation enables the server to apply sophisticated chunking algorithms without exposing implementation details or consuming client resources.

Server-side chunking eliminates the dependency on client-side JavaScript capabilities, ensuring consistent behavior across browsers and devices. Complex document structures requiring specialized parsing logic can be handled uniformly regardless of the user's client configuration. The server environment provides access to native modules and system libraries that may be unavailable or restricted in browser contexts, enabling more sophisticated text extraction and chunk boundary detection.

Resource consumption for chunking is predictable and controllable on the server side. Memory allocation, CPU usage, and processing time can be monitored and limited independently of user sessions. This isolation protects the application from resource exhaustion attacks through maliciously crafted documents and ensures fair resource allocation across concurrent users. Server-side processing also enables caching and reuse of intermediate results when the same document is processed multiple times.

Security benefits of server-side chunking include the ability to sanitize content, apply access control checks during processing, and maintain audit trails for all processing operations. Document content never leaves the server environment during chunking, reducing the attack surface for data exposure. Sensitive documents can be processed with additional security controls that would be impractical or impossible to implement on the client side.

### Client-Side Chunking Assessment

Client-side chunking offers advantages in specific scenarios but generally introduces more complexity than it resolves for most production applications. The primary benefit is reduced server load and bandwidth consumption, particularly for very large documents where transmitting the full document to the server would be impractical. Users with limited connectivity or metered data plans may benefit from local processing that keeps their data on their device.

However, client-side chunking introduces significant implementation complexity and consistency challenges. Different client implementations may produce different chunk boundaries, leading to inconsistent retrieval behavior across user sessions. Maintaining and testing chunking logic across browser versions, mobile operating systems, and device capabilities requires substantial engineering investment that could be directed toward server-side improvements.

The security implications of client-side chunking require careful consideration. Sensitive document content is processed in the browser environment, potentially exposing it to browser extensions, network interception, or local storage vulnerabilities. Compliance requirements for certain industries may prohibit client-side processing of sensitive documents, limiting the applicability of this approach.

For the AI Document Chat application, client-side chunking is not recommended as a primary strategy. If bandwidth constraints for very large documents become problematic, the streaming chunk processing architecture described in the large document section provides a better solution. This approach transmits document content progressively without requiring full document upload, achieving similar bandwidth benefits while maintaining server-side control over chunking logic.

### Semantic Chunking Patterns

Beyond the character-based chunking of RecursiveCharacterTextSplitter, semantic chunking approaches can improve retrieval relevance by respecting document structure and meaning. These approaches identify natural breaks in document content based on headings, paragraphs, and logical sections rather than arbitrary character counts. The improved semantic coherence of chunks typically leads to better retrieval precision and more coherent response generation.

Hierarchical document structure provides natural chunk boundaries that align with human comprehension. Documents organized with clear headings, sections, and subsections can be chunked at these structural boundaries, preserving the context that readers rely on for understanding. The chunk metadata can include the heading hierarchy, enabling context-aware retrieval that considers how chunks relate to document organization.

```typescript
interface HierarchicalChunkConfig {
  maxChunkTokens: number;
  minChunkTokens: number;
  headingDepthLimit: number;
  preserveSectionContext: boolean;
}

async function createHierarchicalChunks(
  document: ParsedDocument,
  config: HierarchicalChunkConfig
): Promise<HierarchicalChunk[]> {
  const sections = identifySections(document, config.headingDepthLimit);
  const chunks: HierarchicalChunk[] = [];

  for (const section of sections) {
    if (section.tokenCount <= config.maxChunkTokens) {
      chunks.push(createSectionChunk(section));
    } else {
      // Split large sections while preserving subsection structure
      const subChunks = splitSectionPreservingStructure(section, config);
      chunks.push(...subChunks);
    }
  }

  return mergeShortChunks(chunks, config.minChunkTokens);
}
```

The semantic chunking implementation should maintain balance between chunk size consistency and semantic coherence. Extremely small chunks lose contextual information while very large chunks dilute specificity and may exceed model context windows during retrieval. The optimal approach often combines structural chunking with size-based splitting for edge cases, providing both semantic integrity and predictable resource usage.

## Retry Logic for Embedding Operations

### Failure Mode Analysis

Embedding operations can fail for several distinct reasons that require different handling strategies. Understanding these failure modes enables implementing targeted retry logic that maximizes success probability while avoiding unnecessary delays for permanent failures. The architecture should distinguish between transient failures suitable for retry and permanent failures that require different handling.

Rate limiting represents the most common transient failure for embedding operations. OpenAI implements rate limits at both request-per-minute and token-per-minute granularity, returning 429 status codes when limits are exceeded. Proper handling requires reading rate limit headers, calculating appropriate wait times, and implementing exponential backoff to avoid thundering herd problems when many requests are queued.

Network failures during embedding API calls can occur at various network layers, presenting as connection timeouts, DNS resolution failures, or incomplete responses. These failures are typically transient and resolve on retry, though persistent network issues may indicate configuration problems requiring investigation. The retry strategy should implement reasonable timeout values and maximum retry attempts to prevent indefinite retry loops.

API errors indicate problems with the request content or service availability. Invalid request errors should not be retried as they will fail identically on subsequent attempts. Server errors (500-range status codes) are candidates for retry since they may be transient. Authentication errors indicate configuration problems that will not resolve through retry and should escalate to error reporting.

### Retry Strategy Implementation

The recommended retry strategy implements exponential backoff with jitter, providing efficient retries for transient failures while avoiding persistent retry storms. The initial backoff should be conservative (1-2 seconds) and increase exponentially up to a maximum delay (30-60 seconds). Jitter randomization prevents synchronized retries from multiple concurrent operations that would overwhelm recovered services.

```typescript
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableStatusCodes: number[];
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!isRetryable(error, config)) {
        throw error;
      }

      if (attempt === config.maxAttempts) {
        throw new RetryExhaustedError(
          `Failed after ${config.maxAttempts} attempts`,
          lastError
        );
      }

      // Calculate backoff with jitter
      const jitteredDelay = delay * config.jitterFactor * (1 + Math.random());
      await sleep(jitteredDelay);
      
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError!;
}

function isRetryable(error: Error, config: RetryConfig): boolean {
  if (error instanceof APIError) {
    return config.retryableStatusCodes.includes(error.status);
  }
  
  if (error instanceof NetworkError) {
    return true;
  }
  
  return false;
}
```

The batch processing context requires additional coordination to handle partial failures gracefully. When embedding a batch of chunks, individual failures should not fail the entire batch unless all chunks fail. Successful chunks can be stored while failed chunks are queued for retry, ensuring partial progress even under adverse conditions. The batch processor should track retry counts per chunk and implement dead-letter handling for chunks that exceed retry limits.

### Circuit Breaker Pattern

For persistent failures that exhaust retry attempts, the circuit breaker pattern prevents cascading failures and allows recovery time for degraded services. The circuit breaker maintains three states: closed (normal operation), open (failures exceeded threshold, requests immediately rejected), and half-open (testing recovery by allowing limited requests).

The circuit breaker implementation tracks recent failure counts and resets failure history during successful operations. When failure count exceeds the threshold within the monitoring window, the breaker transitions to open state. Requests during open state fail immediately with a circuit open error rather than attempting the operation. After the timeout period, the breaker transitions to half-open state to test service recovery.

```typescript
class EmbeddingCircuitBreaker {
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number,
    private timeoutMs: number,
    private halfOpenSuccessThreshold: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError('Embedding service circuit is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastFailureTime = null;

    if (this.state === 'half-open') {
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.reset();
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime.getTime() >= this.timeoutMs;
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = 'closed';
  }
}
```

## Embedding Cost Management

### Cost Analysis Framework

Understanding the cost structure of embedding operations enables informed decisions about tradeoffs between quality and expense. The primary cost driver for OpenAI embeddings is token consumption, with text-embedding-3-small priced at $0.00002 per 1,000 tokens as of early 2026. For a typical document processing scenario with 500-token chunks and 50-token overlap, a 100-page document generating approximately 2,000 chunks would cost roughly $0.20 in embedding costs, a seemingly small amount that scales linearly with document volume.

At scale, embedding costs become significant. Processing 10,000 documents per month, each averaging 100 pages, generates approximately $2,000 in monthly embedding costs. This estimate assumes optimal chunk sizes and does not include costs for retries, reprocessing, or chat query embeddings. Large-scale deployments should budget for embedding costs in the range of $1,000-$5,000 monthly per 50,000 documents processed, with variations based on document complexity and retrieval patterns.

Query volume adds ongoing costs beyond initial document ingestion. Each user question requires embedding generation for the query vector, consuming tokens at chat interaction rates. High-volume chat applications with thousands of daily queries should estimate query embedding costs based on average query length and expected interaction frequency. A conservative estimate of 10 query tokens per interaction across 1,000 daily queries adds approximately $0.20 monthly in query embedding costs, though this scales directly with usage.

### Dimensionality Reduction Strategy

The text-embedding-3 model's support for reduced dimensionality provides a direct mechanism for cost reduction without switching to different embedding models. The 1536-dimensional default embedding captures rich semantic information but can be shortened to 256, 512, or 768 dimensions with graceful degradation in retrieval quality. This trade-off between dimension count and performance enables cost optimization for specific use cases.

Dimensionality reduction through the API dimensions parameter shortens embeddings during generation, reducing storage requirements and accelerating similarity search operations. The smaller vector size reduces memory consumption during search operations and improves cache efficiency for frequently accessed embeddings. For high-volume retrieval workloads, the computational savings from smaller vectors can offset the modest API cost difference.

```typescript
interface EmbeddingConfig {
  model: 'text-embedding-3-small';
  dimensions: 256 | 512 | 768 | 1024 | 1536;
  normalize: boolean;
}

async function createOptimizedEmbedding(
  text: string,
  useCase: EmbeddingUseCase
): Promise<number[]> {
  const config = getEmbeddingConfigForUseCase(useCase);
  
  const response = await openai.embeddings.create({
    model: config.model,
    input: text,
    dimensions: config.dimensions,
    encoding_format: 'float'
  });

  if (config.normalize) {
    return normalizeVector(response.data[0].embedding);
  }

  return response.data[0].embedding;
}

function getEmbeddingConfigForUseCase(
  useCase: EmbeddingUseCase
): EmbeddingConfig {
  switch (useCase) {
    case 'long-document-search':
      return { model: 'text-embedding-3-small', dimensions: 1024, normalize: true };
    case 'precise-fact-retrieval':
      return { model: 'text-embedding-3-small', dimensions: 768, normalize: true };
    case 'broad-topic-clustering':
      return { model: 'text-embedding-3-small', dimensions: 512, normalize: true };
    case 'high-volume-queries':
      return { model: 'text-embedding-3-small', dimensions: 256, normalize: true };
    default:
      return { model: 'text-embedding-3-small', dimensions: 1536, normalize: true };
  }
}
```

### Caching and Reuse Patterns

Caching embedding results for frequently queried content eliminates redundant API calls and reduces both costs and latency. The caching strategy should consider cache hit rates, storage costs, and invalidation requirements to optimize the overall system efficiency. Different caching layers operate at various granularity levels, from individual chunk embeddings to document-level summaries.

Document-level caching stores embeddings for entire documents when queries are likely to match complete documents rather than specific passages. This pattern works well for document retrieval use cases where users search for complete documents rather than specific facts within documents. The cache key combines document identifier with embedding configuration to ensure correct retrieval.

Query result caching stores the results of similarity searches, avoiding both embedding generation and vector search operations for repeated queries. This pattern is particularly effective for FAQ-style applications where users ask similar questions repeatedly. The cache should implement time-based expiration and invalidation on document updates to ensure freshness.

```typescript
interface EmbeddingCache {
  get(key: string): Promise<number[] | null>;
  set(key: string, embedding: number[]): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

async function getCachedEmbedding(
  cache: EmbeddingCache,
  text: string,
  config: EmbeddingConfig
): Promise<number[]> {
  const cacheKey = generateCacheKey(text, config);
  const cached = await cache.get(cacheKey);
  
  if (cached !== null) {
    return cached;
  }

  const embedding = await createEmbeddingWithRetry(text, config);
  await cache.set(cacheKey, embedding);
  
  return embedding;
}
```

## Hybrid Local and Cloud Embeddings

### Architecture Motivation

Hybrid embedding architectures combine local embedding models with cloud services to balance cost, performance, and privacy requirements. Local models run within the application's infrastructure, providing consistent costs regardless of query volume and enabling processing of sensitive data without external transmission. Cloud models offer superior quality, larger context windows, and ongoing model improvements without infrastructure maintenance.

The hybrid approach recognizes that not all embedding operations have identical requirements. High-volume, privacy-insensitive operations benefit from cloud scale and quality, while sensitive content or cost-sensitive operations may favor local processing. The architecture should route embedding requests to appropriate backends based on content classification, user preferences, and operational constraints.

Local embedding models have matured significantly, with open-source models like sentence-transformers providing competitive quality for many use cases. Hardware requirements for local inference vary by model size, with CPU inference feasible for smaller models while GPU acceleration enables real-time processing of larger models. The infrastructure cost comparison between local and cloud embeddings depends on utilization rates, with local models becoming economical at higher volumes.

### Routing Architecture

The embedding router component directs requests to local or cloud embedding services based on configurable policies. The routing decision considers content sensitivity, quality requirements, latency constraints, and cost budgets. Policy configuration can specify explicit routing rules or implement automatic classification based on document metadata or user attributes.

```typescript
type EmbeddingBackend = 'local' | 'cloud';

interface EmbeddingRouterConfig {
  defaultBackend: EmbeddingBackend;
  sensitivityRules: SensitivityRule[];
  fallbackOrder: EmbeddingBackend[];
  qualityThreshold: number;
  maxLatencyMs: number;
}

interface RoutingDecision {
  backend: EmbeddingBackend;
  reason: string;
  expectedLatencyMs: number;
  estimatedCost: number;
}

class EmbeddingRouter {
  constructor(private config: EmbeddingRouterConfig) {}

  async route(request: EmbeddingRequest): Promise<RoutingDecision> {
    // Check sensitivity classification
    const sensitivity = await this.classifySensitivity(request);
    if (sensitivity === 'restricted') {
      return {
        backend: 'local',
        reason: 'Content classified as restricted, local processing required',
        expectedLatencyMs: this.estimateLocalLatency(request),
        estimatedCost: 0
      };
    }

    // Check quality requirements
    if (request.minQuality && this.getCloudQuality() > this.getLocalQuality()) {
      return {
        backend: 'cloud',
        reason: 'Quality threshold requires cloud model',
        expectedLatencyMs: this.estimateCloudLatency(request),
        estimatedCost: this.estimateCloudCost(request)
      };
    }

    // Default to configured default with fallback
    return {
      backend: this.config.defaultBackend,
      reason: 'Default routing based on configuration',
      expectedLatencyMs: this.estimateLatency(this.config.defaultBackend, request),
      estimatedCost: this.estimateCost(this.config.defaultBackend, request)
    };
  }
}
```

### Local Embedding Implementation

Local embedding deployment requires infrastructure for model hosting and inference execution. The recommended approach for Node.js environments uses the transformers.js library, which provides WebAssembly-accelerated inference compatible with server-side JavaScript execution. This library supports various sentence-transformer models with automatic optimization for the target deployment environment.

Model selection balances quality against inference speed and resource requirements. The all-MiniLM-L6-v2 model provides good general-purpose quality with efficient inference, suitable for deployment on moderate hardware. Larger models like all-mpnet-base-v2 offer improved quality at the cost of slower inference and higher memory requirements. The model should be benchmarked against cloud embeddings for the specific use case to validate quality tradeoffs.

```typescript
import { pipeline, env } from '@xenova/transformers';

// Disable local model downloads from Hub
env.allowLocalModels = false;
env.useBrowserCache = false;

class LocalEmbedder {
  private extractor: Pipeline | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  async initialize(): Promise<void> {
    this.extractor = await pipeline('feature-extraction', this.modelName, {
      quantized: true
    });
  }

  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new Error('Local embedder not initialized');
    }

    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true
    });

    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }
}
```

### Quality and Cost Comparison

Hybrid architectures must address quality differences between local and cloud embedding models. Cloud models from OpenAI and other providers are trained on massive datasets and typically outperform local models on general semantic tasks. However, local models can be fine-tuned for specific domains where general-purpose models underperform, potentially exceeding cloud model quality for specialized content.

The quality comparison should be conducted empirically using representative queries and documents from the target domain. A/B testing with production traffic provides the most reliable quality assessment, though offline evaluation using labeled datasets offers faster iteration. The evaluation should measure recall at various k values, mean reciprocal rank for top results, and end-to-end response quality through human evaluation or automated grading.

Cost modeling should include both direct API costs and infrastructure costs for local deployment. Local infrastructure requires upfront investment in compute resources, ongoing maintenance, and operational overhead. The break-even point depends on embedding volume, with local deployment becoming cost-effective at volumes exceeding approximately 100,000 embeddings monthly for typical cloud pricing. Organizations should model their specific cost structure to determine the optimal hybrid balance.

## Conversation Context Management

### Multi-Session Context Architecture

Managing conversation context across multiple chat sessions requires persistent storage of conversation history combined with intelligent retrieval mechanisms that surface relevant context for new queries. Unlike single-session context that fits within model context windows, multi-session context spans time periods that exceed practical context limits and must be selectively retrieved based on relevance to current queries.

The context management architecture implements several layers of context storage and retrieval. The session layer maintains immediate conversation history for the current interaction, typically the last 10-20 messages that fit within context windows. The conversation layer stores complete message histories for each chat session, enabling resumption and reference to earlier exchanges. The knowledge layer connects conversations to source documents, enabling context retrieval that includes relevant passages from previously discussed documents.

```typescript
interface ConversationContext {
  sessionId: string;
  userId: string;
  documentIds: string[];
  messages: Message[];
  lastActivity: Date;
  metadata: ConversationMetadata;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  chunksReferenced?: string[];
}

class ContextManager {
  private sessionCache: Map<string, CachedSession> = new Map();

  async getContextForQuery(
    query: string,
    options: ContextOptions
  ): Promise<RetrievedContext> {
    // Retrieve relevant conversation history
    const conversationHistory = await this.retrieveRelevantHistory(
      query,
      options.sessionId,
      options.maxHistoryMessages
    );

    // Retrieve relevant document chunks from referenced documents
    const documentChunks = await this.retrieveDocumentContext(
      query,
      options.documentIds,
      options.maxChunks
    );

    // Combine and truncate to context window limit
    const combinedContext = this.combineContexts(
      conversationHistory,
      documentChunks
    );

    return this.truncateToWindow(combinedContext, options.maxTokens);
  }

  async createContextualPrompt(
    query: string,
    systemPrompt: string,
    options: ContextOptions
  ): Promise<ContextualPrompt> {
    const context = await this.getContextForQuery(query, options);
    
    return {
      system: systemPrompt,
      messages: context.messages,
      documents: context.chunks,
      tokenCount: this.countTokens(context)
    };
  }
}
```

### Context Retrieval Strategies

Effective context retrieval for multi-session conversations balances relevance, recency, and diversity. Purely similarity-based retrieval may over-weight recent conversations while under-weighting earlier sessions that contain relevant information. The retrieval strategy should combine multiple signals including semantic similarity, recency weighting, and explicit user or system prioritization.

Semantic retrieval from conversation history identifies messages and exchanges relevant to the current query. This approach treats message content as searchable content, enabling retrieval of prior discussions about related topics. The retrieval should consider the full message content including both user questions and assistant responses, recognizing that valuable context may appear in either role.

```typescript
interface ConversationRetrievalConfig {
  maxMessages: number;
  maxTokens: number;
  recencyWeight: number;
  similarityThreshold: number;
  includeSystemMessages: boolean;
}

async function retrieveRelevantHistory(
  query: string,
  sessionId: string,
  config: ConversationRetrievalConfig
): Promise<Message[]> {
  // Get session messages
  const sessionMessages = await this.getSessionMessages(sessionId);
  
  // Embed query for similarity search
  const queryEmbedding = await this.embedQuery(query);
  
  // Score messages by combined similarity and recency
  const scoredMessages = sessionMessages.map(message => ({
    message,
    similarity: cosineSimilarity(message.embedding, queryEmbedding),
    recency: calculateRecencyScore(message.timestamp, config.recencyWeight)
  }));

  // Sort and filter by similarity threshold
  const relevantMessages = scoredMessages
    .filter(m => m.similarity >= config.similarityThreshold)
    .sort((a, b) => (b.similarity + b.recency) - (a.similarity + a.recency))
    .slice(0, config.maxMessages)
    .map(m => m.message);

  // Truncate to token limit
  return this.truncateMessages(relevantMessages, config.maxTokens);
}
```

### Session Persistence Design

Session persistence maintains conversation state across user sessions, enabling users to return to previous conversations and continue discussions. The persistence layer must balance storage costs against retention requirements, implement efficient retrieval for session resumption, and handle concurrent modifications when users maintain multiple active sessions.

The database schema for session persistence separates metadata from message content, enabling efficient querying for session lists while storing message content in a format optimized for retrieval. Message content should include embeddings for semantic retrieval across session histories, though embedding storage adds cost that scales with message volume.

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  document_ids UUID[] DEFAULT '{}',
  status SESSION_STATUS DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id),
  role MESSAGE_ROLE NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding VECTOR(1536),
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id);
CREATE INDEX idx_messages_embedding ON chat_messages USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_sessions_user ON chat_sessions(user_id, last_message_at DESC);
```

### Context Window Optimization

Managing limited context windows requires selective inclusion of the most relevant context while excluding less valuable content. The optimization strategy should identify and preserve critical information including user preferences, established facts from prior conversation, and document content that has been thoroughly discussed. Less critical content like routine acknowledgments and off-topic digressions can be压缩或排除.

Prompt compression techniques reduce token consumption while preserving semantic content. Abstractive summarization generates condensed versions of message histories that capture key points without verbatim repetition. The compression ratio should adapt based on available context space and the importance of preserved details.

```typescript
interface CompressedContext {
  originalMessages: number;
  compressedMessages: number;
  compressionRatio: number;
  preservedTopics: string[];
  lostDetails: string[];
}

async function compressContext(
  messages: Message[],
  availableTokens: number
): Promise<{ compressed: Message[]; compression: CompressedContext }> {
  const originalTokenCount = countMessageTokens(messages);
  
  if (originalTokenCount <= availableTokens) {
    return {
      compressed: messages,
      compression: {
        originalMessages: messages.length,
        compressedMessages: messages.length,
        compressionRatio: 1,
        preservedTopics: extractTopics(messages),
        lostDetails: []
      }
    };
  }

  // Identify preserve-worthy content
  const preservedContent = identifyPreservedContent(messages);
  const compressibleContent = identifyCompressibleContent(messages);

  // Generate summaries for compressible content
  const summaryMessages = await generateSummaries(compressibleContent);
  
  // Combine preserved and summarized content
  const combined = [...preservedContent, ...summaryMessages];
  const truncated = truncateMessages(combined, availableTokens);

  return {
    compressed: truncated,
    compression: {
      originalMessages: messages.length,
      compressedMessages: truncated.length,
      compressionRatio: truncated.length / messages.length,
      preservedTopics: extractTopics(preservedContent),
      lostDetails: extractLostDetails(compressibleContent, summaryMessages)
    }
  };
}
```

## Implementation Recommendations

### Priority Order for Architecture Enhancements

Based on the research findings, the following enhancements should be implemented in priority order to improve the current architecture. Each recommendation addresses specific gaps identified in the research while maintaining compatibility with the existing Next.js 14 and Supabase foundation.

The first priority should be implementing robust retry logic with circuit breakers for embedding operations. This enhancement addresses reliability concerns for production deployments without requiring significant architectural changes. The implementation should use the exponential backoff with jitter pattern and integrate with the existing embedding service calls.

Second priority should be adding streaming chunk processing for large documents, enabling reliable processing of files exceeding platform limits. This enhancement addresses the large document handling gap identified in the research and enables processing of enterprise-scale documents. The implementation should integrate with existing document storage and use Supabase for progress tracking.

Third priority should be implementing conversation persistence and context management, enabling multi-session chat experiences. This enhancement addresses user experience requirements for returning users and enables sophisticated context retrieval across sessions. The implementation should extend the existing session model with full message history and embeddings.

### Component Integration Patterns

The architecture components should integrate through well-defined interfaces that enable independent testing, replacement, and scaling. Each major component should expose a TypeScript interface that defines its capabilities, input contracts, and output contracts. This interface-driven approach enables mock implementations for testing and supports gradual migration between implementations.

The document processing pipeline should integrate through an ingestion interface that accepts document references and returns processing results asynchronously. The streaming nature of large document processing requires callback-based progress reporting and error handling that supports partial completion. The interface should support both synchronous processing for small documents and asynchronous processing for large documents.

The query pipeline should integrate through a retrieval interface that accepts query strings and returns relevant chunks with citations. This interface should support the streaming chat workflow by enabling progressive result return as chunks are identified. The interface should also support context augmentation from conversation history when requested.

### Monitoring and Observability

Production RAG systems require comprehensive monitoring to ensure quality, performance, and cost targets are met. The observability strategy should implement metrics collection, distributed tracing, and logging at each pipeline stage. Key metrics include embedding latency and success rates, retrieval relevance scores, response quality assessments, and operational costs.

Retrieval quality monitoring should track the relevance of retrieved chunks through implicit and explicit feedback mechanisms. Implicit signals like message ratings, follow-up questions, and session continuation indicate retrieval success, while explicit feedback provides direct quality signals. Aggregate quality metrics should be tracked per document and per query pattern to identify problem areas.

Cost monitoring should track embedding generation costs by document, user, and time period. Real-time cost dashboards enable detection of anomalous usage patterns that may indicate abuse or errors. Cost allocation tracking supports internal billing and capacity planning decisions.

## Conclusion

The validated architecture patterns presented in this document provide a comprehensive foundation for production RAG pipeline implementation. The recommendations address the six research questions through established patterns that balance reliability, cost, and user experience considerations. The architecture extends the current Next.js 14 and Supabase foundation with specific implementations for large document handling, retry logic, cost management, and conversation persistence.

The implementation sequence prioritizes reliability enhancements (retry logic, circuit breakers) before scaling features (large document processing) before user experience features (conversation persistence). This sequence ensures a stable foundation before adding capabilities that introduce additional complexity.

Future architecture evolution should consider emerging patterns like adaptive chunking that adjusts chunk sizes based on document characteristics, query-aware retrieval that reformulates queries based on conversation context, and quality-guided retrieval that adapts search parameters based on query difficulty assessment. These patterns can be layered onto the established foundation as the application matures and user needs evolve.
