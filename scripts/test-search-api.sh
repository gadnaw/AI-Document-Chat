#!/bin/bash
# Test script for /api/search endpoint

API_URL="${API_URL:-http://localhost:3000/api/search}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token}"

echo "Testing /api/search endpoint..."
echo

# Test 1: Basic search
echo "Test 1: Basic search query"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"query": "quarterly revenue results", "topK": 5}' | jq '.'
echo

# Test 2: Search with threshold
echo "Test 2: High threshold filter"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"query": "revenue", "threshold": 0.8, "topK": 3}' | jq '.'
echo

# Test 3: Document filter
echo "Test 3: Filtered by document ID"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"query": "findings", "documentIds": ["doc-uuid-1", "doc-uuid-2"]}' | jq '.'
echo

echo "Test 4: Invalid request (empty query)"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"query": ""}' | jq '.'
echo

echo "All tests completed!"
