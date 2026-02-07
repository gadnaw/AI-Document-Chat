#!/bin/bash
# Cache performance monitoring script

API_URL="${API_URL:-http://localhost:3000}"

echo "Cache Performance Report"
echo "========================"
echo

echo "1. Cache Health Check"
curl -s "$API_URL/api/cache/invalidate" | jq '.'
echo

echo "2. Cache Statistics"
curl -s "$API_URL/api/cache/stats" | jq '.'
echo

echo "3. Search Cache Statistics"
curl -s "$API_URL/api/search/stats" | jq '.'
echo

echo "4. Pretty Statistics"
curl -s "$API_URL/api/cache/stats?format=text"
echo
