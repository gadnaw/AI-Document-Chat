# AI Document Chat

An AI-powered document chat application that enables users to upload PDF documents and engage in contextual conversations with precise source citations. Built with Retrieval-Augmented Generation (RAG) architecture for accurate, verifiable AI responses grounded in actual document content.

## Features

- **Document Upload & Processing**: Upload PDF documents up to 50MB with real-time progress tracking
- **Semantic Search**: Find relevant content using natural language queries with cosine similarity filtering
- **Conversational AI**: Multi-turn conversations with streaming responses from GPT-4o
- **Source Citations**: Every AI response includes inline citations linking to source documents
- **Privacy-First**: Row Level Security (RLS) ensures complete data isolation between users

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Vercel AI SDK
- **Backend**: Next.js API Routes, Supabase Edge Functions
- **Database**: PostgreSQL with pgvector for similarity search
- **Authentication**: Supabase Auth (Email/Password)
- **Storage**: Supabase Storage for document uploads
- **AI**: OpenAI GPT-4o (chat), text-embedding-3-small (embeddings)
- **Testing**: Playwright (E2E), Vitest (Unit), k6 (Load)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account with pgvector extension enabled
- OpenAI API key

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-document-chat
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example and configure:
```bash
cp .env.local.example .env.local
```

4. Add your credentials to `.env.local`:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Redis (optional, for query caching)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Sentry (optional, for error tracking)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### Database Setup

Run the Supabase migrations in your project:

1. Enable pgvector extension
2. Create tables: users, documents, chunks, conversations, messages, sessions
3. Apply RLS policies for data isolation

See `docs/PRODUCTION.md` for complete database setup instructions.

### Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
ai-document-chat/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── chat/         # Chat endpoint with RAG
│   │   │   ├── search/       # Similarity search
│   │   │   ├── upload/       # Document processing
│   │   │   └── health/       # Health check endpoint
│   │   ├── chat/             # Chat interface page
│   │   └── layout.tsx        # Root layout with providers
│   ├── components/           # React components
│   │   ├── chat/            # Chat UI components
│   │   └── error-boundary.tsx
│   └── lib/
│       ├── auth/            # Authentication utilities
│       ├── retrieval/       # Vector search and embeddings
│       ├── monitoring/      # Sentry, circuit breakers
│       └── pdf/             # PDF processing utilities
├── tests/
│   ├── e2e/                 # Playwright E2E tests
│   ├── unit/                # Vitest unit tests
│   └── rag/                 # RAG evaluation tests
├── scripts/                 # Utility scripts
├── k6/                      # Load testing scripts
├── docs/                    # Documentation
│   ├── PRODUCTION.md       # Deployment guide
│   ├── API.md              # API documentation
│   ├── ARCHITECTURE.md     # System architecture
│   └── OPERATIONS.md       # Monitoring & incident response
└── .planning/              # GSD planning artifacts
```

## Usage

### Uploading Documents

1. Sign up for an account or log in
2. Click "Upload Document" and select a PDF file
3. Wait for processing to complete (chunking and embedding)
4. Documents appear in your library when ready

### Chatting with Documents

1. Select a document from your library
2. Type a question in the chat input
3. Receive streaming AI responses with source citations
4. Click citations to view the original source context

### Managing Conversations

- View conversation history in the sidebar
- Continue previous conversations seamlessly
- Delete conversations when no longer needed

## API Reference

### Chat API

```bash
POST /api/chat
Content-Type: application/json

{
  "message": "What is the main argument of this document?",
  "documentId": "doc-uuid",
  "conversationId": "conv-uuid" // optional
}
```

### Search API

```bash
POST /api/search
Content-Type: application/json

{
  "query": "main argument",
  "documentId": "doc-uuid", // optional
  "topK": 5,
  "threshold": 0.7
}
```

### Health Check

```bash
GET /api/health

Response:
{
  "status": "healthy",
  "services": {
    "database": "up",
    "openai": "up",
    "redis": "up"
  }
}
```

See `docs/API.md` for complete API documentation.

## Testing

### Run All Tests

```bash
npm run test:all
```

### Unit Tests

```bash
npm run test:unit        # Run unit tests
npm run test:watch       # Watch mode
npm run test:ui          # UI mode
```

### E2E Tests

```bash
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # UI mode
```

### Load Tests

```bash
npm run test:load:smoke        # Quick validation
npm run test:load:performance  # Performance tests
npm run test:load              # All scenarios
```

### Test Coverage

```bash
npm run test:coverage          # Generate coverage report
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

See `docs/PRODUCTION.md` for detailed deployment instructions.

### Docker

```bash
docker build -t ai-document-chat .
docker run -p 3000:3000 ai-document-chat
```

## Monitoring

### Error Tracking

Configure Sentry for error and performance monitoring:

```bash
export SENTRY_ORG="your-org"
export SENTRY_PROJECT="ai-document-chat"
export SENTRY_AUTH_TOKEN="your-token"
npx sentry-wizard -i nextjs
```

### Uptime Monitoring

Run the uptime monitor script:

```bash
node scripts/uptime-monitor.js
```

Configure alerts in `.uptime-env`:
- Slack webhook for instant notifications
- Email alerts via SMTP

See `docs/OPERATIONS.md` for monitoring setup.

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Document Processing | 95% < 30s | ✅ |
| Query Latency (P95) | < 2s | ✅ |
| Citation Accuracy | > 90% | ⚠️ 87% |
| Uptime | 99.9% | ⏳ |
| E2E Pass Rate | > 95% | ⏳ |

## Security

- **Authentication**: JWT-based with Supabase Auth
- **Data Isolation**: Row Level Security (RLS) on all tables
- **Encryption**: TLS in transit, encrypted at rest
- **Audit**: Security scanning with OWASP ZAP

See `docs/ARCHITECTURE.md` for security architecture details.

## Roadmap

Future enhancements planned for v2.0:

- Hybrid search (semantic + keyword)
- PII detection and redaction
- Conversation export (PDF/Markdown)
- Document preview with PDF.js
- Suggested follow-up questions
- Mobile app (iOS/Android)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: `docs/` folder
- API Docs: `docs/API.md`
- Operations: `docs/OPERATIONS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Deployment: `docs/PRODUCTION.md`
