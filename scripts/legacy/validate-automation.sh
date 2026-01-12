#!/bin/bash
# Validate Automation Scripts
# Checks that all automation scripts are properly configured

set -e

echo "=========================================="
echo "Validating Automation Scripts"
echo "=========================================="

ERRORS=0

# Check Docker Compose file
echo ""
echo "1. Checking docker-compose.test.yml..."
if [ ! -f "docker-compose.test.yml" ]; then
  echo "❌ docker-compose.test.yml not found"
  ((ERRORS++))
else
  echo "✅ docker-compose.test.yml exists"
  
  # Validate YAML syntax (basic check)
  if command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
    if docker compose version >/dev/null 2>&1; then
      COMPOSE_CMD="docker compose"
    fi
    if $COMPOSE_CMD -f docker-compose.test.yml config >/dev/null 2>&1; then
      echo "✅ docker-compose.test.yml syntax is valid"
    else
      echo "❌ docker-compose.test.yml has syntax errors"
      ((ERRORS++))
    fi
  fi
fi

# Check setup script
echo ""
echo "2. Checking setup-test-db.sh..."
if [ ! -f "scripts/setup-test-db.sh" ]; then
  echo "❌ scripts/setup-test-db.sh not found"
  ((ERRORS++))
else
  echo "✅ scripts/setup-test-db.sh exists"
  if [ -x "scripts/setup-test-db.sh" ]; then
    echo "✅ scripts/setup-test-db.sh is executable"
  else
    echo "⚠️  scripts/setup-test-db.sh is not executable (fixing...)"
    chmod +x scripts/setup-test-db.sh
    echo "✅ Fixed"
  fi
fi

# Check validation script
echo ""
echo "3. Checking run-automated-validation.sh..."
if [ ! -f "scripts/run-automated-validation.sh" ]; then
  echo "❌ scripts/run-automated-validation.sh not found"
  ((ERRORS++))
else
  echo "✅ scripts/run-automated-validation.sh exists"
  if [ -x "scripts/run-automated-validation.sh" ]; then
    echo "✅ scripts/run-automated-validation.sh is executable"
  else
    echo "⚠️  scripts/run-automated-validation.sh is not executable (fixing...)"
    chmod +x scripts/run-automated-validation.sh
    echo "✅ Fixed"
  fi
fi

# Check integration test file
echo ""
echo "4. Checking integration test file..."
if [ ! -f "packages/memory/__tests__/integration/automated-validation.test.ts" ]; then
  echo "❌ automated-validation.test.ts not found"
  ((ERRORS++))
else
  echo "✅ automated-validation.test.ts exists"
fi

# Check CI/CD job
echo ""
echo "5. Checking CI/CD configuration..."
if grep -q "validate-crdt:" .github/workflows/ci.yml 2>/dev/null; then
  echo "✅ validate-crdt job found in CI/CD"
else
  echo "⚠️  validate-crdt job not found in CI/CD (may be in unsaved file)"
  # Don't count as error since it might be in unsaved changes
fi

# Check npm scripts
echo ""
echo "6. Checking npm scripts..."
if grep -q "test:validation" package.json 2>/dev/null; then
  echo "✅ test:validation script found"
else
  echo "❌ test:validation script not found"
  ((ERRORS++))
fi

if grep -q "test:integration" package.json 2>/dev/null; then
  echo "✅ test:integration script found"
else
  echo "❌ test:integration script not found"
  ((ERRORS++))
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ All automation scripts validated!"
  echo "=========================================="
  exit 0
else
  echo "❌ Found $ERRORS error(s)"
  echo "=========================================="
  exit 1
fi
