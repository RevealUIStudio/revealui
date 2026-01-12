#!/bin/bash
# Test API Routes
# This script tests all memory API routes

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=========================================="
echo "API Route Testing"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

test_route() {
    local method=$1
    local path=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$path" || echo -e "\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$path" || echo -e "\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $http_code)"
        echo "  Response: $body"
        ((FAILED++))
        return 1
    fi
}

# Test session IDs and user IDs (replace with actual IDs from your database)
SESSION_ID="test-session-$(date +%s)"
USER_ID="test-user-$(date +%s)"

echo "Using test IDs:"
echo "  SESSION_ID: $SESSION_ID"
echo "  USER_ID: $USER_ID"
echo ""

# Test 1: GET /api/memory/working/:sessionId
test_route "GET" "/api/memory/working/$SESSION_ID" "" "200" "GET working memory"

# Test 2: POST /api/memory/working/:sessionId
test_route "POST" "/api/memory/working/$SESSION_ID" \
    '{"context":{"test":"value"},"sessionState":{},"activeAgents":[]}' \
    "200" "POST working memory"

# Test 3: GET /api/memory/episodic/:userId
test_route "GET" "/api/memory/episodic/$USER_ID" "" "200" "GET episodic memory"

# Test 4: POST /api/memory/episodic/:userId (valid)
test_route "POST" "/api/memory/episodic/$USER_ID" \
    '{"id":"mem-1","content":"Test","type":"fact","source":{"type":"user","id":"'$USER_ID'","confidence":1},"embedding":{"model":"openai-text-embedding-3-small","vector":[0.1,0.2,0.3],"dimension":3,"generatedAt":"2025-01-01T00:00:00.000Z"},"createdAt":"2025-01-01T00:00:00.000Z"}' \
    "200" "POST episodic memory (valid)"

# Test 5: POST /api/memory/episodic/:userId (invalid embedding)
test_route "POST" "/api/memory/episodic/$USER_ID" \
    '{"id":"mem-2","content":"Test","type":"fact","source":{"type":"user","id":"'$USER_ID'","confidence":1},"embedding":{"model":"invalid","vector":[1,2,3],"dimension":1536,"generatedAt":"2025-01-01T00:00:00.000Z"},"createdAt":"2025-01-01T00:00:00.000Z"}' \
    "422" "POST episodic memory (invalid embedding)"

# Test 6: DELETE /api/memory/episodic/:userId/:memoryId
test_route "DELETE" "/api/memory/episodic/$USER_ID/mem-1" "" "200" "DELETE episodic memory"

# Test 7: Invalid sessionId
test_route "GET" "/api/memory/working/" "" "404" "GET working memory (invalid)"

# Test 8: Invalid userId
test_route "GET" "/api/memory/episodic/" "" "404" "GET episodic memory (invalid)"

echo ""
echo "=========================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
