# Production Deployment Guide

This document provides comprehensive instructions for deploying the AI Document Chat application to production.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Deployment Options](#deployment-options)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

---

## Overview

The AI Document Chat is a Next.js application that uses:
- **Framework**: Next.js 14+ with App Router
- **Database**: Supabase (PostgreSQL with pgvector)
- **Authentication**: Supabase Auth
- **AI/ML**: OpenAI GPT-4o for chat, text-embedding-3-small for embeddings
- **Storage**: Supabase Storage
- **Caching**: Upstash Redis

---

## Prerequisites

Before deploying, ensure you have:

### Required Accounts

1. **Vercel Account** - For hosting the Next.js application
   - Sign up: https://vercel.com
   - Recommended: Connect GitHub for CI/CD

2. **Supabase Account** - For database and authentication
   - Sign up: https://supabase.com
   - Create a new project

3. **OpenAI Account** - For AI capabilities
   - Sign up: https://platform.openai.com
   - Generate API key

4. **Upstash Account** - For Redis caching (optional but recommended)
   - Sign up: https://upstash.com
   - Create a Redis database

### Required Tools

```bash
# Node.js 18+ required
node --version  # Must be >= 18

# Git installed
git --version

# Vercel CLI (optional but recommended)
npm i -g vercel

# Supabase CLI (for migrations)
npm i -g supabase
```

---

## Environment Configuration

### 1. Create Environment Variables

Create a `.env.production` file in the project root:

```bash
# Application
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production

# Supabase (Get from Supabase Dashboard -> Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-openai-api-key

# Redis (Get from Upstash Console)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Sentry (Optional - for error monitoring)
# Get from https://your-org.sentry.io/settings/auth-tokens/
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=ai-document-chat
SENTRY_AUTH_TOKEN=your-auth-token
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project

# Analytics (Optional)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### 2. Vercel Environment Variables

Add these via Vercel Dashboard or CLI:

```bash
# Via Vercel CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add OPENAI_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add SENTRY_AUTH_TOKEN production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
```

---

## Database Setup

### 1. Supabase Project Setup

1. Create a new Supabase project at https://supabase.com
2. Wait for the database to initialize (typically 1-2 minutes)

### 2. Enable pgvector Extension

Run this SQL in Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 3. Apply Database Schema

1. Go to Supabase Dashboard -> SQL Editor
2. Open `supabase/schema.sql`
3. Run the SQL to create all tables and policies

Or use migration files:

```bash
# If using Supabase CLI
supabase db push
```

### 4. Enable Row Level Security

All tables have RLS enabled by default. Verify:

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 5. Create Storage Bucket

1. Go to Supabase Dashboard -> Storage
2. Create a new bucket named `documents`
3. Set to private (not public)
4. Add RLS policies as documented in the schema

---

## Deployment Options

### Option 1: Vercel (Recommended)

#### Automatic Deployment

1. Connect your GitHub repository to Vercel:
   ```bash
   vercel link
   ```

2. Deploy to production:
   ```bash
   vercel --prod
   ```

3. Set environment variables in Vercel Dashboard

#### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Option 2: Docker

#### Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Build and Run

```bash
# Build image
docker build -t ai-document-chat .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e OPENAI_API_KEY=... \
  -e UPSTASH_REDIS_REST_URL=... \
  -e UPSTASH_REDIS_REST_TOKEN=... \
  ai-document-chat
```

### Option 3: Custom Server

For VPS or custom hosting:

```bash
# Install dependencies
npm ci --only=production

# Build
npm run build

# Run with process manager (PM2 recommended)
pm2 start npm --name "ai-document-chat" -- start

# Configure reverse proxy (Nginx/Apache)
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "1.0.0",
  "services": {
    "database": { "status": "up" },
    "supabase": { "status": "up" },
    "openai": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### 2. Functionality Tests

```bash
# Test authentication flow
# 1. Visit https://your-domain.com/login
# 2. Create account
# 3. Verify email (if enabled)

# Test document upload
# 1. Login to application
# 2. Upload a test PDF
# 3. Verify processing completes

# Test chat functionality
# 1. Select uploaded document
# 2. Send test message
# 3. Verify streaming response with citations
```

### 3. Performance Validation

Run load tests:

```bash
npm run test:load:smoke
npm run test:load:performance
```

Expected results:
- Document processing: 95% < 30s
- Query latency p95: < 2 seconds
- Error rate: < 1%

### 4. Security Verification

Run security scan:

```bash
node scripts/security-scan.js baseline
```

Verify:
- Zero critical vulnerabilities
- Zero high vulnerabilities
- All security headers present

---

## Rollback Procedures

### Vercel Rollback

1. **Via Dashboard**:
   - Go to Vercel Dashboard -> Deployments
   - Find previous working deployment
   - Click "Deploy" button

2. **Via CLI**:
   ```bash
   # List deployments
   vercel list
   
   # Rollback to previous
   vercel rollback <deployment-url>
   ```

### Database Rollback

If database changes are needed:

```bash
# Restore from backup
supabase db restore backup.sql
```

### Rollback Checklist

- [ ] Frontend reverted
- [ ] API reverted  
- [ ] Database schema compatible
- [ ] Environment variables preserved
- [ ] Tests pass
- [ ] Health check responds

---

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem**: Users can't login or signup

**Solutions**:
- Verify Supabase Auth is enabled
- Check email templates are configured
- Ensure redirect URLs are correct
- Check CORS settings

```bash
# Verify auth configuration
curl https://your-project.supabase.co/auth/v1/settings
```

#### 2. Database Connection Errors

**Problem**: Application can't connect to Supabase

**Solutions**:
- Verify environment variables are set
- Check RLS policies aren't blocking
- Ensure database is awake (Supabase free tier sleeps)

```bash
# Test database connection
supabase db ping
```

#### 3. OpenAI API Errors

**Problem**: Chat doesn't work, API errors

**Solutions**:
- Verify API key is valid
- Check usage limits
- Review rate limits

```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### 4. File Upload Failures

**Problem**: Document uploads fail

**Solutions**:
- Verify storage bucket exists
- Check storage policies
- Ensure bucket isn't full

#### 5. Slow Performance

**Problem**: Application is slow

**Solutions**:
- Check database query performance
- Verify Redis cache is working
- Monitor OpenAI API latency
- Review server resources

### Debug Commands

```bash
# Check application logs
vercel logs --deployment=your-deployment-id

# Check environment
vercel env pull
echo $NEXT_PUBLIC_SUPABASE_URL

# Test API endpoint
curl -v https://your-domain.com/api/health

# Monitor database
supabase db stats
```

---

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check security scans
   - Monitor performance metrics

2. **Monthly**
   - Review and rotate API keys
   - Update dependencies
   - Security audit

3. **Quarterly**
   - Disaster recovery test
   - Load testing
   - Penetration testing

### Monitoring

- **Uptime**: Use the uptime monitor script
- **Errors**: Monitor Sentry dashboard
- **Performance**: Use Vercel Analytics
- **Database**: Supabase Dashboard metrics

---

## Support

For deployment issues:

1. Check application logs
2. Review this troubleshooting guide
3. Check Vercel Status
4. Check Supabase Status
5. Check OpenAI Status

---

**Last Updated**: 2026-02-07  
**Version**: 1.0.0
