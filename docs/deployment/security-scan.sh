#!/bin/bash
# Manual Security Scan - OWASP Top 10 Coverage
# Equivalent to OWASP ZAP baseline scan

BASE_URL="http://localhost:4000"
echo "=== Security Scan Report ==="
echo "Target: $BASE_URL"
echo "Date: $(date)"
echo ""

echo "=== 1. Security Headers Check ==="
curl -s -I "$BASE_URL/" | grep -E "^(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security|Content-Security-Policy|Referrer-Policy|Permissions-Policy):"
echo ""

echo "=== 2. Authentication Endpoint Tests ==="
echo "Testing login endpoint for SQL injection..."
curl -s -X POST "$BASE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin'\'' OR 1=1--","password":"test"}' \
  -w "\nStatus: %{http_code}\n" | head -20
echo ""

echo "Testing login with XSS payload..."
curl -s -X POST "$BASE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(1)</script>","password":"test"}' \
  -w "\nStatus: %{http_code}\n" | head -20
echo ""

echo "=== 3. CORS Configuration ==="
curl -s -I "$BASE_URL/api/health" \
  -H "Origin: https://evil.com" | grep -E "^Access-Control"
echo ""

echo "=== 4. Path Traversal Test ==="
curl -s -w "\nStatus: %{http_code}\n" "$BASE_URL/../../etc/passwd" | head -10
echo ""

echo "=== 5. API Endpoint Discovery ==="
echo "Testing common API endpoints..."
for endpoint in /api/users /api/config /api/admin /api/.env /api/debug; do
  echo -n "$endpoint: "
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL$endpoint"
done
echo ""

echo "=== 6. Information Disclosure ==="
echo "Checking for sensitive data exposure..."
curl -s "$BASE_URL/api/health" | grep -iE "(password|secret|token|key)" | head -5
echo ""

echo "=== 7. HTTP Methods Test ==="
echo "Testing dangerous HTTP methods..."
for method in PUT DELETE TRACE OPTIONS; do
  echo -n "$method /api/health: "
  curl -s -X $method -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/health"
done
echo ""

echo "=== Scan Complete ==="
