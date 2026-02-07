# Domain Pitfalls: AI Document Chat (RAG Pipeline)

**Project:** Upwork Portfolio Demo - RAG Application
**Researched:** February 7, 2026
**Confidence Level:** MEDIUM-HIGH

---

## Executive Summary

This document catalogs critical, moderate, and minor pitfalls encountered when building production-quality RAG applications. For a cost-conscious portfolio demo using GPT-4o-mini and pgvector, several pitfalls require special attention: hallucination prevention, retrieval quality optimization, rate limiting resilience, and document security handling. The research draws from Ragas evaluation frameworks, Pinecone's RAG architecture guidance, and production deployment patterns. Key mitigation strategies include implementing strict context grounding prompts, using hybrid search (dense + sparse vectors), establishing comprehensive evaluation pipelines with Ragas metrics, and building robust retry logic with exponential backoff for OpenAI API calls.

---

## Critical Pitfalls

Mistakes in these categories can cause complete system failure, significant hallucination problems, security breaches, or user trust erosion.

### Pitfall 1: Hallucination Beyond Document Context

**What Goes Wrong:**
The LLM generates responses that include information not present in the retrieved document chunks. Users receive confident-sounding but factually incorrect answers. This undermines trust and defeats the primary purpose of RAG.

**Why It Happens:**
- Prompt engineering fails to enforce strict context adherence
- Retrieved chunks are irrelevant to the query (retrieval failure)
- The LLM has enough internal knowledge to "fill gaps" confidently
- No citation or grounding verification step exists
- Temperature or sampling settings are too high, encouraging creative generation

**Consequences:**
- User distrust in the system
- Potential liability for incorrect information
- Application becomes unreliable for any serious use
- Negative portfolio demonstration that appears amateur

**Prevention Strategies:**

Implement strict grounding prompts that explicitly require the model to:
- Only use information from provided context
- Cite sources with page numbers or chunk references
- Admit uncertainty when context doesn't contain answers
- Distinguish between factual claims and inferential reasoning

Example grounding prompt structure:
```
You are a helpful assistant answering questions about uploaded documents.

CONTEXT:
{retrieved_chunks}

QUESTION:
{user_question}

INSTRUCTIONS:
1. Use ONLY information from the CONTEXT above
2. If the CONTEXT doesn't contain the answer, say "I don't know based on the uploaded documents"
3. Cite your sources like this: [Source X]
4. Do NOT add any information not in the CONTEXT
5. If you must infer, clearly state "Based on the context, it appears that..."

ANSWER:
```

**Detection and Warning Signs:**
- Responses containing information not in retrieved chunks
- Users reporting "the AI made things up"
- High similarity between response and LLM's training data but low similarity to documents
- No source citations in responses
- Confident answers to questions about obscure topics not in documents

**Recommended Monitoring:**
- Implement Ragas Faithfulness metric to measure answer-to-context alignment
- Log all responses with their source chunks for manual review
- Create a "hallucination trap" test set with known ground truth
- Track the percentage of responses that cite sources

---

### Pitfall 2: Poor Retrieval Quality - Irrelevant Chunks

**What Goes Wrong:**
The vector search returns chunks that are semantically similar to the query but don't actually contain the information needed to answer the question. Users receive irrelevant context, leading to poor answers even with perfect prompting.

**Why It Happens:**
- Embedding model doesn't match your domain language
- Chunking strategy creates poor semantic units
- No hybrid search (missing keyword matching for specific terms)
- Metadata filtering is insufficient
- Query embedding quality is poor (ambiguous queries)
- The index contains low-quality or noisy text

**Consequences:**
- Users can't find information they know exists in documents
- Apparent system failure (retrieval working, but wrong results)
- Frustrating user experience
- Questions fail to retrieve any relevant chunks

**Prevention Strategies:**

**1. Implement Hybrid Search:**
Combine dense vector similarity (semantic) with sparse vector/keyword search (lexical). This handles both conceptual queries and specific terminology, product names, acronyms, and proper nouns.

**2. Optimize Chunking Strategy:**
- Use semantic chunking (sentence-based with overlap) rather than fixed character counts
- Aim for chunks of 512-1024 tokens that form coherent thought units
- Include surrounding context (paragraph headers, section titles) as metadata
- Use overlap of 10-20% to prevent thought splitting across boundaries

**3. Choose Domain-Appropriate Embeddings:**
- General-purpose embeddings (text-embedding-3-small) work well for most documents
- For specialized domains (medical, legal, technical), consider fine-tuned embeddings
- Test embedding quality with sample queries before full indexing

**4. Implement Reranking:**
After initial retrieval (10-50 chunks), use a cross-encoder reranker to score chunk-question relevance and return only the top 3-5 most relevant chunks.

**Detection and Warning Signs:**
- "I don't know" responses when documents clearly contain answers
- Retrieved chunks that are tangentially related but not relevant
- Users needing to rephrase queries multiple times
- Consistent failure for specific document types
- High similarity scores for retrieved chunks but low answer quality

**Recommended Testing:**
- Create a retrieval evaluation set with ground-truth chunk mappings
- Track Hit Rate and Mean Reciprocal Rank (MRR)
- Monitor the distribution of relevance scores in retrieval results

---

### Pitfall 3: Rate Limiting During Bulk Document Processing

**What Goes Wrong:**
When processing multiple documents or re-indexing, OpenAI API calls hit rate limits, causing timeouts, failures, or excessive costs from retry storms. Bulk operations become unreliable or prohibitively expensive.

**Why It Happens:**
- OpenAI enforces rate limits by tokens per minute (TPM) and requests per minute (RPM)
- pgvector upserts with OpenAI embeddings generate many rapid API calls
- No retry logic with exponential backoff
- No request queuing or throttling mechanism
- Concurrency exceeds API limits

**Consequences:**
- Incomplete document indexing
- Long processing times with timeout failures
- Excessive costs from retry storms
- User-facing errors during document uploads
- Unreliable production system

**Prevention Strategies:**

**1. Implement Token Tracking and Throttling:**
```python
class RateLimiter:
    def __init__(self, tpm_limit=150000, rpm_limit=3500):
        self.tpm_limit = tpm_limit
        self.rpm_limit = rpm_limit
        self.token_usage = deque(maxlen=60)
        self.request_times = deque(maxlen=60)
    
    async def acquire(self, estimated_tokens):
        while self._would_exceed_limit(estimated_tokens):
            await asyncio.sleep(1)
        self._record_usage(estimated_tokens)
    
    def _would_exceed_limit(self, tokens):
        # Check if adding these tokens exceeds TPM/RPM limits
        recent_tokens = sum(self.token_usage)
        recent_requests = len(self.request_times)
        return (recent_tokens + tokens > self.tpm_limit or 
                recent_requests >= self.rpm_limit)
```

**2. Use Exponential Backoff with Jitter:**
```python
async def embed_with_retry(texts, max_retries=5):
    for attempt in range(max_retries):
        try:
            return await openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=texts
            )
        except RateLimitError:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            await asyncio.sleep(wait_time)
    raise Exception(f"Failed after {max_retries} retries")
```

**3. Batch Processing:**
- Batch embedding requests (up to 2048 items per request for OpenAI)
- Process documents sequentially or in controlled concurrency
- Use async queues for background processing

**4. Monitoring and Alerting:**
- Track TPM/RPM usage in real-time
- Alert when approaching limits
- Log retry attempts and failures

**Detection and Warning Signs:**
- RateLimitError exceptions in logs
- Document processing times much longer than expected
- Incomplete document indexes
- Retry count metrics increasing
- Users reporting failed uploads

---

### Pitfall 4: Document Parsing Failures and Data Corruption

**What Goes Wrong:**
Corrupt PDFs, unusual encodings, scanned documents without OCR, or malformed files cause parsing failures. Partial or incorrect text extraction leads to gaps in the knowledge base.

**Why It Happens:**
- PDFs use non-standard encoding or encryption
- Scanned documents are images without text layers
- Complex layouts (tables, multi-column) break simple parsers
- File corruption during upload or storage
- Unsupported file formats

**Consequences:**
- Missing content from documents
- Incomplete knowledge base
- Users unable to upload certain files
- Silent failures that aren't discovered until query time

**Prevention Strategies:**

**1. Multi-Modal Parsing Pipeline:**
```python
async def parse_document(file_path, file_type):
    parsers = {
        '.pdf': [parse_pdf_with_ocr, parse_pdf_text],
        '.docx': parse_docx_text,
        '.txt': parse_with_encoding_detection,
        '.md': parse_markdown,
        '.html': parse_html_text
    }
    
    for parser in parsers.get(file_type, []):
        try:
            result = await parser(file_path)
            if result and result.quality_score > threshold:
                return result
        except Exception:
            continue
    
    raise DocumentParseError(f"All parsers failed for {file_path}")
```

**2. Encoding Detection:**
For text files, detect encoding before reading:
```python
import chardet

def detect_and_read(file_path):
    with open(file_path, 'rb') as f:
        raw_data = f.read(1024)
        detection = chardet.detect(raw_data)
    
    with open(file_path, 'r', encoding=detection['encoding']) as f:
        return f.read()
```

**3. Quality Validation:**
- Validate extracted text length against expected size
- Check for excessive whitespace or garbled characters
- Flag documents with low text-to-image ratios
- Log parsing quality scores for review

**4. User Feedback:**
- Notify users when parsing fails partially
- Provide specific error messages (e.g., "This appears to be a scanned PDF without text")
- Allow users to retry with different parsing options

**Detection and Warning Signs:**
- Documents with very low character counts
- High ratio of non-printable characters
- Missing expected sections in parsed content
- User reports of "empty" or "corrupt" documents
- Parser exceptions in logs

---

### Pitfall 5: Embedding Model Mismatch with Query Language

**What Goes Wrong:**
The embedding model doesn't handle the language, terminology, or query patterns in your documents, leading to poor semantic similarity even for clearly relevant queries.

**Why It Happens:**
- Using general embeddings on specialized domain documents
- Multilingual documents with inconsistent embedding support
- Query language differs significantly from document language
- Acronyms, jargon, or domain-specific terms aren't well-represented
- Embedding model training data doesn't cover your use case

**Consequences:**
- Semantically similar queries retrieve irrelevant results
- Users must use exact document phrasing
- System appears "dumb" despite good retrieval architecture
- Domain-specific queries consistently fail

**Prevention Strategies:**

**1. Test Embeddings with Real Queries:**
Before committing to an embedding model, test with your actual query patterns:
```python
def evaluate_embedding_model(documents, queries, relevance judgments):
    model = TextEmbedding(model="text-embedding-3-small")
    
    results = []
    for query in queries:
        query_embedding = model.embed(query)
        doc_embeddings = model.embed_batch([d.content for d in documents])
        
        # Calculate similarity and rank
        similarities = cosine_similarity(query_embedding, doc_embeddings)
        ranked = sorted(zip(range(len(similarities)), similarities), 
                       key=lambda x: x[1], reverse=True)
        
        results.append({
            'query': query,
            'expected_relevant': [relevant_ids],
            'retrieved_top_k': [d for d, _ in ranked[:10]]
        })
    
    return calculate_hit_rate(results)
```

**2. Consider Domain-Specific Embeddings:**
- Medical: PubMedBERT, BioClinicalBERT
- Legal: Legal-BERT, CaseLaw-BERT
- Code: CodeBERT, StarCoder
- Multilingual: multilingual-e5-large

**3. Query Expansion:**
Transform queries to match document language:
```python
def expand_query(user_query):
    expansion_prompt = """
    Original query: {query}
    
    Generate 3-5 alternative phrasings that:
    1. Use more formal/academic language
    2. Include possible synonyms
    3. Add domain-specific terminology
    4. Include possible abbreviations
    
    Return as JSON list of alternative queries.
    """
    
    expanded = llm.generate(expansion_prompt, response_format={"type": "json_object"})
    return [user_query] + expanded.alternative_queries
```

**4. Hybrid Search as Safety Net:**
Even with imperfect embeddings, keyword search provides reliable fallback for specific terms.

**Detection and Warning Signs:**
- Consistent failure for queries containing specific terminology
- Much better results for queries using document exact phrasing
- Poor performance on domain-specific queries
- Users reporting "I know it's in there but can't find it"

---

## Moderate Pitfalls

These pitfalls cause delays, technical debt, or degraded user experience but don't cause complete system failure.

### Pitfall 6: Cost Management at Scale

**What Goes Wrong:**
Embedding costs and LLM API costs grow linearly or super-linearly with document volume and user queries. Cost controls are insufficient, leading to unexpected bills or the need to throttle usage.

**Why It Happens:**
- No limits on embedding operations
- No caching of frequent queries or embeddings
- Large context windows sent to LLM for every query
- No rate limiting on user queries
- Expensive embedding models used when cheaper alternatives suffice

**Prevention Strategies:**

**1. Use Cost-Effective Models:**
- Embeddings: text-embedding-3-small ($0.00002/1K tokens) instead of text-embedding-3-large
- Generation: GPT-4o-mini ($0.00015/1K input, $0.0006/1K output) instead of GPT-4o

**2. Implement Semantic Caching:**
```python
class SemanticCache:
    def __init__(self, similarity_threshold=0.95):
        self.cache = {}
        self.threshold = similarity_threshold
    
    async def get(self, query):
        cached = None
        for cached_query, (response, _) in self.cache.items():
            similarity = cosine_similarity(
                self.embed(query), 
                self.embed(cached_query)
            )
            if similarity > self.threshold:
                cached = (cached_query, response)
                break
        return cached
    
    async def set(self, query, response):
        self.cache[query] = (response, time.now())
        # Evict old entries periodically
```

**3. Context Optimization:**
- Only retrieve and send the most relevant chunks (3-5)
- Use prompt compression techniques
- Implement RAGfusion or similar re-ranking to reduce context size

**4. Usage Monitoring:**
- Track costs per user, per document, per query
- Set budget alerts at thresholds (e.g., 50%, 80% of expected spend)
- Implement per-user rate limits

**Estimated Costs (GPT-4o-mini + text-embedding-3-small):**
- 100 documents (avg 10 pages each, ~5000 chars/page): ~$0.50 for initial embedding
- 1000 user queries: ~$1.00-5.00 depending on context size
- Monthly cost for moderate usage: $10-50

---

### Pitfall 7: PII and Sensitive Data Exposure

**What Goes Wrong:**
Personal Identifiable Information (PII) in uploaded documents is indexed, stored, and potentially exposed through query responses. This creates legal liability and user trust issues.

**Why It Happens:**
- No automatic PII detection during document processing
- PII is indexed alongside regular content
- Query responses may include PII from context
- Logs and monitoring capture PII
- Vector database stores raw text that could be queried for PII

**Consequences:**
- GDPR, CCPA, HIPAA violations
- User data breaches
- Reputational damage
- Legal liability
- Loss of user trust

**Prevention Strategies:**

**1. PII Detection and Redaction:**
```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

class PIIRedactor:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
    
    def redact(self, text, entities=None):
        if entities is None:
            entities = [
                "PERSON", "PHONE_NUMBER", "EMAIL_ADDRESS",
                "SOCIAL_SECURITY_NUMBER", "CREDIT_CARD",
                "IBAN_CODE", "US_SSN", "US_PASSPORT",
                "US_DRIVER_LICENSE", "US_ITIN", "US_TELEPHONE_NUMBER"
            ]
        
        # Detect PII
        results = self.analyzer.analyze(text=text, entities=entities, language='en')
        
        # Anonymize
        anonymized = self.anonymizer.anonymize(
            text=text,
            analyzer_results=results
        )
        
        return anonymized.text
```

**2. PII Tagging Instead of Redaction:**
For some use cases, replace PII with tagged placeholders:
- "[PERSON_1]" for person names
- "[DATE_1]" for dates
- "[EMAIL_1]" for emails

**3. Document-Level Access Controls:**
- Tag documents with sensitivity levels
- Filter queries based on user permissions
- Never index sensitive documents without redaction

**4. Logging and Monitoring:**
- Ensure logs don't capture raw PII
- Audit query logs for potential PII exposure
- Monitor for suspicious PII-search patterns

**Detection and Warning Signs:**
- PII entities detected in document analysis
- Queries that seem designed to extract PII
- Logs containing raw personal information
- Users uploading obviously sensitive documents (tax returns, medical records)

---

### Pitfall 8: Chunk Boundary Issues - Split Thoughts

**What Goes Wrong:**
Logical thoughts, sentences, or related information are split across chunk boundaries. The LLM receives partial context and cannot understand the full meaning, leading to incomplete or incorrect answers.

**Why It Happens:**
- Fixed-size chunking (e.g., 1000 characters regardless of content)
- Chunk boundaries at sentence mid-points
- No overlap between chunks
- Document structure (headers, lists) not preserved

**Consequences:**
- Questions about concepts spanning chunk boundaries fail
- Answers reference incomplete information
- Context-dependent queries fail to retrieve full context
- Users receive confusing partial answers

**Prevention Strategies:**

**1. Semantic Chunking:**
```python
import nltk
from sentence_transformers import SentenceTransformer

def semantic_chunk(text, similarity_threshold=0.7, max_chunk_size=1024):
    sentences = nltk.sent_tokenize(text)
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    chunks = []
    current_chunk = []
    current_embeddings = []
    
    for sentence in sentences:
        embedding = model.encode(sentence)
        
        if (len(current_chunk) > 0 and 
            cosine_similarity(embedding, current_embeddings[-1]) < similarity_threshold):
            # Save current chunk and start new one
            chunks.append(' '.join(current_chunk))
            current_chunk = [sentence]
            current_embeddings = [embedding]
        else:
            current_chunk.append(sentence)
            current_embeddings.append(embedding)
        
        # Hard limit check
        if len(' '.join(current_chunk)) > max_chunk_size:
            chunks.append(' '.join(current_chunk))
            current_chunk = []
            current_embeddings = []
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks
```

**2. 10-20% Overlap:**
Always include overlap between adjacent chunks to ensure continuity:
```python
def chunk_with_overlap(text, chunk_size, overlap_ratio=0.1):
    chunks = []
    overlap_size = int(chunk_size * overlap_ratio)
    
    for i in range(0, len(text), chunk_size - overlap_size):
        chunks.append(text[i:i + chunk_size])
        if i + chunk_size >= len(text):
            break
    
    return chunks
```

**3. Preserve Document Structure:**
- Include section headers in each relevant chunk
- Mark list continuations ("...continued from previous")
- Preserve paragraph context in metadata

**Detection and Warning Signs:**
- Queries about topics that span paragraphs frequently fail
- Retrieved chunks cut off mid-sentence
- Answers that reference "the previous section" without context
- Users reporting "it almost had the answer but missed something"

---

### Pitfall 9: Toxic and Malicious User Uploads

**What Goes Wrong:**
Users upload offensive, illegal, or malicious content (malware disguised as documents, CSAM, hate speech, etc.). The system processes and potentially serves this content to other users or stores it inappropriately.

**Why It Happens:**
- No content scanning during upload
- No file type restrictions
- No size limits
- No user reporting mechanisms
- Processing pipeline doesn't validate content

**Consequences:**
- Platform policy violations
- Legal liability for hosting harmful content
- Reputation damage
- Security vulnerabilities
- Bad actor exploitation

**Prevention Strategies:**

**1. File Type Restrictions:**
```python
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt', '.md', '.html'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def validate_uploaded_file(filename, file_content, file_size):
    # Check extension
    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise InvalidFileTypeError(f"File type not allowed: {filename}")
    
    # Check size
    if file_size > MAX_FILE_SIZE:
        raise FileTooLargeError(f"File exceeds {MAX_FILE_SIZE} bytes")
    
    # Check magic bytes/PDF header
    if filename.endswith('.pdf'):
        if not file_content[:4] == b'%PDF':
            raise InvalidFileError("Invalid PDF format")
    
    # Additional: scan for malicious patterns
    return validate_content_safe(file_content)
```

**2. Content Moderation:**
- Use OpenAI Content Moderation API on extracted text
- Implement keyword filtering for known harmful content patterns
- Flag documents for manual review if moderation scores are high

**3. Malware Scanning:**
- Integrate with ClamAV or similar for virus scanning
- Don't execute or parse potentially executable content
- Sandboxed processing for unknown file types

**4. User Reporting and Takedown:**
- Allow users to report offensive documents
- Implement rapid takedown procedures
- Log all uploads with moderation status

**Detection and Warning Signs:**
- Content moderation API flags on document text
- Unusual file types or sizes
- Documents with embedded scripts or macros
- User reports of offensive content
- Automated system alerts for policy violations

---

## Minor Pitfalls

These pitfalls cause annoyance, technical debt, or minor user experience issues but are relatively easy to fix.

### Pitfall 10: Missing Source Citations and Traceability

**What Goes Wrong:**
The system provides answers without indicating which documents or sections supported them. Users cannot verify information or understand the source of claims.

**Why It Happens:**
- Prompt doesn't require citations
- No metadata stored with chunks
- Retrieval results not logged
- No UI for showing sources

**Prevention:**
- Always include source citations in prompts
- Store document metadata (filename, page number) with chunks
- Display source chunks alongside answers in UI

---

### Pitfall 11: Long Query Latency

**What Goes Wrong:**
Queries take 5-10+ seconds to return results, leading to poor user experience. Users perceive the system as slow or unresponsive.

**Why It Happens:**
- No async processing
- Large context windows taking time to process
- Single-threaded retrieval
- No caching

**Prevention:**
- Implement streaming responses
- Use async pgvector queries
- Cache embedding results
- Show "searching..." UI feedback

---

### Pitfall 12: Poor Handling of Follow-up Questions

**What Goes Wrong:**
The system fails to maintain conversation context across follow-up questions. Users must re-explain context that was established in previous messages.

**Why It Happens:**
- No conversation history maintained
- Follow-up queries treated as independent
- No coreference resolution
- Chat interface doesn't track context

**Prevention:**
- Implement conversation memory
- Rewrite follow-up queries to include context
- Use conversation ID for session tracking
- Maintain context window across conversation

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Document Ingestion** | Parsing failures, chunk boundary issues, rate limiting | Multi-parser pipeline, semantic chunking, token tracking |
| **Retrieval Implementation** | Poor quality chunks, embedding mismatch, missing hybrid search | Ragas evaluation, hybrid search, reranking |
| **LLM Integration** | Hallucination, cost overruns, no citations | Grounding prompts, cost monitoring, source display |
| **Security Implementation** | PII exposure, toxic content, no access controls | PII redaction, content moderation, permission system |
| **Production Deployment** | Rate limits, latency issues, caching failures | Exponential backoff, async processing, semantic cache |

---

## Research Gaps and Validation Needed

**Items Requiring Phase-Specific Research:**

1. **pgvector Performance at Scale** - Index performance with 10K+ documents needs validation
2. **Specific PII Detection Accuracy** - Presidio may need tuning for your document types
3. **Real-world Hallucination Rates** - Initial Ragas evaluation needed to establish baseline
4. **User Query Patterns** - Actual query language may differ from expected
5. **Cost Modeling** - Actual costs depend on user behavior patterns

---

## Sources and Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| Hallucination Prevention | HIGH | Ragas documentation, Pinecone RAG guide, LangChain concepts |
| Evaluation Metrics | HIGH | Ragas official documentation (docs.ragas.io) |
| Retrieval Quality | HIGH | Pinecone hybrid search guide, production RAG patterns |
| Rate Limiting | MEDIUM | OpenAI API documentation, production deployment patterns |
| PII Handling | MEDIUM | GDPR/CCPA requirements, Presidio documentation |
| Chunking Strategies | HIGH | Semantic chunking research, production implementations |
| Content Moderation | LOW | Need to verify current OpenAI moderation API capabilities |

---

## Immediate Action Items

1. **Set up Ragas evaluation pipeline** with Faithfulness and Context Precision metrics
2. **Implement grounding prompts** with explicit citation requirements
3. **Add semantic chunking** with 10% overlap before full indexing
4. **Configure rate limiting** with exponential backoff for OpenAI calls
5. **Add PII detection** using Presidio during document ingestion
6. **Implement hybrid search** with both vector and keyword capabilities
7. **Create hallucination test set** with known ground truth queries

---

*Document Version: 1.0*
*Last Updated: February 7, 2026*
