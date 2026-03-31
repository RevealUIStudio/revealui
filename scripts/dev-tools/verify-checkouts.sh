#!/usr/bin/env bash
# verify-checkouts.sh — Automated Stripe checkout flow verification
#
# Prerequisites:
#   1. API running locally: pnpm dev:api (port 3004)
#   2. Authenticated session cookie (sign in via CMS first)
#   3. Stripe test mode keys configured
#
# Usage:
#   ./scripts/dev-tools/verify-checkouts.sh <session-cookie>
#
# This script hits every billing endpoint and reports pass/fail.
# It does NOT complete Stripe checkout (that requires a browser).
# It verifies the API creates valid Stripe sessions.

set -euo pipefail

API="${API_BASE_URL:-http://localhost:3004}"
COOKIE="${1:?Usage: verify-checkouts.sh <session-cookie-value>}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

check() {
  local name="$1" method="$2" path="$3" body="${4:-}" expected="${5:-200}"

  local args=(-s -o /tmp/vc-response.json -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "Cookie: revealui-session=$COOKIE")

  if [ "$method" = "POST" ] && [ -n "$body" ]; then
    args+=(-X POST -d "$body")
  elif [ "$method" = "POST" ]; then
    args+=(-X POST)
  fi

  local status
  status=$(curl "${args[@]}" "${API}${path}")

  if [ "$status" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC}  $name (HTTP $status)"
    PASS=$((PASS + 1))
  elif [ "$status" = "401" ]; then
    echo -e "  ${YELLOW}SKIP${NC}  $name — not authenticated (HTTP 401)"
    SKIP=$((SKIP + 1))
  elif [ "$status" = "400" ] && [ "$expected" = "200|400" ]; then
    echo -e "  ${GREEN}PASS${NC}  $name (HTTP $status — expected rejection)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $name — expected $expected, got $status"
    cat /tmp/vc-response.json 2>/dev/null | head -3
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== Stripe Checkout Flow Verification ==="
echo "API: $API"
echo ""

# ── 1. Health check ──────────────────────────────────────────────────
echo "── API Health ──"
check "Health/live" GET "/health/live" "" "200"
echo ""

# ── 2. Subscription checkouts ───────────────────────────────────────
echo "── Subscription Checkout ──"
check "Checkout (pro)" POST "/api/billing/checkout" '{"tier":"pro"}' "200"
check "Checkout (max)" POST "/api/billing/checkout" '{"tier":"max"}' "200"
check "Checkout (enterprise)" POST "/api/billing/checkout" '{"tier":"enterprise"}' "200"
echo ""

# ── 3. Perpetual license checkouts ──────────────────────────────────
echo "── Perpetual License Checkout ──"
check "Perpetual (pro)" POST "/api/billing/checkout-perpetual" '{"tier":"pro"}' "200"
check "Perpetual (max)" POST "/api/billing/checkout-perpetual" '{"tier":"max"}' "200"
check "Perpetual (enterprise)" POST "/api/billing/checkout-perpetual" '{"tier":"enterprise"}' "200"
echo ""

# ── 4. Credits checkout ─────────────────────────────────────────────
echo "── Credits Checkout ──"
check "Credits (starter)" POST "/api/billing/checkout-credits" '{"bundle":"starter"}' "200"
check "Credits (standard)" POST "/api/billing/checkout-credits" '{"bundle":"standard"}' "200"
check "Credits (scale)" POST "/api/billing/checkout-credits" '{"bundle":"scale"}' "200"
echo ""

# ── 5. Billing portal ───────────────────────────────────────────────
echo "── Billing Portal ──"
check "Portal session" POST "/api/billing/portal" "" "200"
echo ""

# ── 6. Upgrade (will fail if no active subscription — that's OK) ───
echo "── Upgrade (expects 400 if no subscription) ──"
check "Upgrade to max" POST "/api/billing/upgrade" '{"targetTier":"max"}' "200|400"
echo ""

# ── 7. Downgrade (will fail if no active subscription — that's OK) ─
echo "── Downgrade (expects 400 if no subscription) ──"
check "Downgrade to free" POST "/api/billing/downgrade" "" "200|400"
echo ""

# ── 8. RVUI Payment (should be disabled) ────────────────────────────
echo "── RVUI Payment (should be 501) ──"
check "RVUI payment disabled" POST "/api/billing/rvui-payment" '{"amount":"1"}' "501"
echo ""

# ── Summary ─────────────────────────────────────────────────────────
echo "=== Results ==="
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}SKIP: $SKIP${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Some checks failed. Review output above.${NC}"
  exit 1
elif [ "$SKIP" -gt 0 ]; then
  echo -e "${YELLOW}Some checks skipped (auth). Re-run with a valid session cookie.${NC}"
  exit 0
else
  echo -e "${GREEN}All checkout flows verified.${NC}"
  exit 0
fi
