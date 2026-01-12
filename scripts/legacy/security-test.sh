#!/bin/bash

# Security Testing Script for RevealUI Framework
# Based on PENETRATION-TESTING-GUIDE.md

set -e

BASE_URL="${BASE_URL:-http://localhost:4000}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPassword123}"

echo "🔒 Starting Security Tests for RevealUI Framework"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

# 1. Test Rate Limiting
echo "1. Testing Rate Limiting..."
RATE_LIMIT_FAILED=0
for i in {1..10}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"wrong@example.com\",\"password\":\"wrong\"}")
    
    if [ "$i" -gt 5 ] && [ "$RESPONSE" != "429" ]; then
        RATE_LIMIT_FAILED=1
    fi
done
test_result $RATE_LIMIT_FAILED "Rate limiting blocks after 5 attempts"

# 2. Test Security Headers
echo "2. Testing Security Headers..."
HEADERS=$(curl -s -I "$BASE_URL/api/health")
HAS_X_FRAME=$(echo "$HEADERS" | grep -i "X-Frame-Options" | wc -l)
HAS_X_CONTENT_TYPE=$(echo "$HEADERS" | grep -i "X-Content-Type-Options" | wc -l)
HAS_CSP=$(echo "$HEADERS" | grep -i "Content-Security-Policy" | wc -l)

if [ "$HAS_X_FRAME" -eq 0 ] || [ "$HAS_X_CONTENT_TYPE" -eq 0 ]; then
    test_result 1 "Security headers present"
else
    test_result 0 "Security headers present"
fi

# 3. Test CORS Configuration
echo "3. Testing CORS Configuration..."
CORS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE_URL/api/health" \
    -H "Origin: https://malicious-site.com" \
    -H "Access-Control-Request-Method: GET")

# Should reject unauthorized origins
if [ "$CORS_RESPONSE" == "200" ]; then
    # Check if CORS headers are present and restrictive
    CORS_HEADERS=$(curl -s -I -X OPTIONS "$BASE_URL/api/health" \
        -H "Origin: https://malicious-site.com")
    HAS_CORS_ORIGIN=$(echo "$CORS_HEADERS" | grep -i "Access-Control-Allow-Origin" | wc -l)
    test_result $HAS_CORS_ORIGIN "CORS properly configured"
else
    test_result 0 "CORS properly configured"
fi

# 4. Test SQL Injection Prevention
echo "4. Testing SQL Injection Prevention..."
SQL_INJECTION=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/pages?where[title][equals]=1' OR '1'='1")
test_result $([ "$SQL_INJECTION" != "500" ] && [ "$SQL_INJECTION" != "200" ] || echo "$SQL_INJECTION" | grep -q "error") "SQL injection prevented"

# 5. Test XSS Prevention
echo "5. Testing XSS Prevention..."
XSS_PAYLOAD="<script>alert('XSS')</script>"
XSS_RESPONSE=$(curl -s "$BASE_URL/api/pages?title=$XSS_PAYLOAD")
HAS_SCRIPT_TAG=$(echo "$XSS_RESPONSE" | grep -i "<script>" | wc -l)
test_result $([ "$HAS_SCRIPT_TAG" -eq 0 ]) "XSS prevention working"

# 6. Test Authentication Required
echo "6. Testing Authentication Requirements..."
AUTH_REQUIRED=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users" \
    -H "Content-Type: application/json" \
    -X POST \
    -d "{\"email\":\"test@example.com\",\"password\":\"test\"}")
test_result $([ "$AUTH_REQUIRED" == "401" ] || [ "$AUTH_REQUIRED" == "403" ]) "Protected endpoints require authentication"

# 7. Test JWT Token Validation
echo "7. Testing JWT Token Validation..."
INVALID_TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users" \
    -H "Authorization: JWT invalid-token-here")
test_result $([ "$INVALID_TOKEN_RESPONSE" == "401" ] || [ "$INVALID_TOKEN_RESPONSE" == "403" ]) "Invalid JWT tokens rejected"

# 8. Test Health Endpoint
echo "8. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
HAS_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status"' | wc -l)
test_result $([ "$HAS_STATUS" -gt 0 ]) "Health endpoint accessible"

# Summary
echo ""
echo "=========================================="
echo "Security Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All security tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some security tests failed. Review the results above.${NC}"
    exit 1
fi

