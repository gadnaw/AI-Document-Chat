# API Documentation

This document provides comprehensive documentation for all API endpoints in the AI Document Chat application.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-1)
  - [Documents](#documents)
  - [Chat](#chat)
  - [Search](#search)
  - [System](#system)
- [Webhooks](#webhooks)

---

## Overview

The API follows RESTful conventions and uses JSON for request/response bodies.

### Base URL

```
Production: https://your-app.vercel.app
Development: http://localhost:3000
```

### Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

### API Version

Current version: `v1`

---

## Authentication

### Supabase Auth Integration

All authenticated endpoints require a Supabase JWT token in the Authorization header:

```
Authorization: Bearer <supabase-jwt-token>
```

### Obtaining Tokens

Tokens are obtained through Supabase Auth:

```bash
# Login request
POST /auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "user-password"
}

# Response
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### Token Refresh

```bash
POST /auth/v1/token?grant_type=refresh_token
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}
```

---

## Rate Limiting

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Chat | 20 requests | 1 minute |
| Document Upload | 10 requests | 1 minute |
| Search | 30 requests | 1 minute |
| Auth | 5 requests | 1 minute |
| Health Check | 100 requests | 1 minute |

### Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1640995200
```

### Rate Limit Errors

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please slow down.",
    "details": {
      "retryAfter": 30
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Error |
| 503 | Service Unavailable |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": {
      "field": "Validation details"
    },
    "timestamp": "2026-02-07T14:52:35Z",
    "path": "/api/endpoint",
    "requestId": "uuid"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Invalid or missing token |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Endpoints

### Authentication

#### Login

```
POST /auth/v1/token?grant_type=password
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "user-password"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### Signup

```
POST /auth/v1/signup
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "options": {
    "data": {
      "full_name": "John Doe"
    }
  }
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-02-07T14:52:35Z"
  }
}
```

#### Logout

```
POST /auth/v1/logout
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true
}
```

#### Get User

```
GET /auth/v1/user
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "email_confirmed_at": "2026-02-07T14:52:35Z",
  "created_at": "2026-02-07T14:52:35Z",
  "updated_at": "2026-02-07T14:52:35Z"
}
```

---

### Documents

#### List Documents

```
GET /api/documents
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |
| status | string | No | Filter by status |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "doc-uuid",
      "name": "document.pdf",
      "status": "processed",
      "size": 1048576,
      "chunk_count": 150,
      "created_at": "2026-02-07T14:52:35Z",
      "updated_at": "2026-02-07T14:52:35Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "hasMore": true
  }
}
```

#### Upload Document

```
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PDF file (max 50MB) |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "doc-uuid",
    "name": "document.pdf",
    "status": "processing",
    "upload_url": null,
    "created_at": "2026-02-07T14:52:35Z"
  }
}
```

**Progress Tracking:**

Subscribe to Supabase Realtime for progress updates:

```javascript
const subscription = supabase
  .channel('documents')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents',
    filter: `id=eq.${documentId}`
  }, (payload) => {
    console.log('Progress:', payload.new.status);
  })
  .subscribe();
```

#### Get Document

```
GET /api/documents/:id
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "doc-uuid",
    "name": "document.pdf",
    "status": "processed",
    "size": 1048576,
    "chunk_count": 150,
    "metadata": {
      "pages": 45,
      "author": "John Doe"
    },
    "created_at": "2026-02-07T14:52:35Z",
    "updated_at": "2026-02-07T14:52:35Z"
  }
}
```

#### Delete Document

```
DELETE /api/documents/:id
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

### Chat

#### Create Conversation

```
POST /api/chat
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "title": "My Chat Session"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "conv-uuid",
    "title": "My Chat Session",
    "created_at": "2026-02-07T14:52:35Z"
  }
}
```

#### Send Message (Streaming)

```
POST /api/chat/:conversationId
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "What is the main idea of this document?",
  "documents": ["doc-uuid-1", "doc-uuid-2"],
  "stream": true
}
```

**Response (200) - Streaming:**

```
data: {
  "id": "msg-uuid",
  "content": "Based on the document, ",
  "citations": [],
  "done": false
}

data: {
  "id": "msg-uuid", 
  "content": "Based on the document, the main idea is that...",
  "citations": [
    {
      "document_id": "doc-uuid-1",
      "chunk_id": "chunk-uuid",
      "source": "Page 3",
      "relevance": 0.85
    }
  ],
  "done": true,
  "usage": {
    "prompt_tokens": 1500,
    "completion_tokens": 250,
    "total_tokens": 1750
  }
}
```

**Response (200) - Non-streaming:**

```json
{
  "success": true,
  "data": {
    "id": "msg-uuid",
    "content": "Based on the document, the main idea is...",
    "citations": [
      {
        "document_id": "doc-uuid-1",
        "chunk_id": "chunk-uuid",
        "source": "Page 3",
        "relevance": 0.85
      }
    ],
    "usage": {
      "prompt_tokens": 1500,
      "completion_tokens": 250,
      "total_tokens": 1750
    }
  }
}
```

#### Get Conversation Messages

```
GET /api/chat/:conversationId
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "What is this document about?",
      "created_at": "2026-02-07T14:52:35Z"
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "This document discusses...",
      "citations": [...],
      "created_at": "2026-02-07T14:52:36Z"
    }
  ],
  "meta": {
    "total_messages": 10,
    "hasMore": false
  }
}
```

#### Delete Conversation

```
DELETE /api/chat/:conversationId
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

### Search

#### Semantic Search

```
POST /api/search
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "query": "key findings and conclusions",
  "documents": ["doc-uuid-1", "doc-uuid-2"],
  "limit": 10,
  "threshold": 0.7
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "query": "key findings and conclusions",
    "results": [
      {
        "chunk_id": "chunk-uuid",
        "document_id": "doc-uuid-1",
        "document_name": "annual-report.pdf",
        "content": "The key findings include...",
        "page": 12,
        "similarity": 0.89,
        "metadata": {
          "chunk_index": 45
        }
      }
    ],
    "search_time_ms": 150
  }
}
```

#### Get Similar Documents

```
POST /api/retrieve
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "document_id": "doc-uuid",
  "limit": 5
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "document": {
      "id": "doc-uuid",
      "name": "document.pdf"
    },
    "chunks": [
      {
        "id": "chunk-uuid",
        "index": 0,
        "content": "...",
        "metadata": {}
      }
    ]
  }
}
```

---

### System

#### Health Check

```
GET /api/health
```

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-07T14:52:35Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "up",
      "latency_ms": 45
    },
    "supabase": {
      "status": "up",
      "latency_ms": 50
    },
    "openai": {
      "status": "up",
      "latency_ms": 250
    },
    "redis": {
      "status": "up",
      "latency_ms": 10
    }
  },
  "system": {
    "memory": {
      "used_mb": 150,
      "total_mb": 512,
      "usage_percent": 29
    },
    "uptime_seconds": 86400
  }
}
```

#### Readiness Probe

```
HEAD /api/health
```

**Response:** 200 OK

#### Liveness Probe

```
GET /api/health
```

**Response:** 200 OK if healthy, 503 if unhealthy

---

## Webhooks

### Document Processing Complete

Webhook sent when document processing completes:

```
POST /webhooks/document-processed
Content-Type: application/json
X-Webhook-Signature: sha256=...
```

**Payload:**

```json
{
  "event": "document.processed",
  "timestamp": "2026-02-07T14:52:35Z",
  "data": {
    "document_id": "doc-uuid",
    "status": "processed",
    "chunk_count": 150,
    "processing_time_ms": 15000
  }
}
```

### Chat Message Generated

Webhook sent when streaming completes:

```
POST /webhooks/message-complete
Content-Type: application/json
X-Webhook-Signature: sha256=...
```

**Payload:**

```json
{
  "event": "chat.message_complete",
  "timestamp": "2026-02-07T14:52:35Z",
  "data": {
    "conversation_id": "conv-uuid",
    "message_id": "msg-uuid",
    "token_usage": 1750,
    "processing_time_ms": 3500
  }
}
```

---

## Rate Limiting Details

### Request Costs

| Endpoint | Cost (units) |
|----------|--------------|
| Chat message | 1 unit |
| Document upload | 5 units |
| Search | 1 unit |
| List documents | 1 unit |

### Default Limits

| Plan | Units/Day | Units/Minute |
|------|-----------|--------------|
| Free | 1000 | 10 |
| Pro | 10000 | 50 |
| Enterprise | Unlimited | 100 |

---

**Last Updated**: 2026-02-07  
**Version**: 1.0.0
