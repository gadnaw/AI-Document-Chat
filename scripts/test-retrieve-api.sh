#!/bin/bash
# Test script for /api/retrieve endpoint

API_URL="${API_URL:-http://localhost:3000/api/retrieve}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token}"

echo "Testing /api/retrieve endpoint..."
echo

echo "Test 1: Retrieve chunks for RAG context"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"query": "What were the key decisions made?", "topK": 5}' | jq '.'
echo

echo "Test 2: Retrieve with strict threshold"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"query": "quarterly results", "threshold": 0.75, "topK": 3}' | jq '.'
echo

echo "All tests completed!"
