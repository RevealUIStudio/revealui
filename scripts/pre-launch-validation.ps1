# Pre-Launch Validation Script (PowerShell)
# Runs comprehensive checks before production deployment

$ErrorActionPreference = "Stop"

$PASSED = 0
$FAILED = 0
$WARNINGS = 0

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
    $script:PASSED++
}

function Write-Failure {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    $script:FAILED++
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
    $script:WARNINGS++
}

Write-Host "🚀 Pre-Launch Validation for RevealUI Framework" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Type Checking
Write-Host "1. Running TypeScript type checking..."
try {
    pnpm typecheck:all 2>&1 | Out-Null
    Write-Success "Type checking passed"
} catch {
    Write-Failure "Type checking failed"
    Write-Host "   Run: pnpm typecheck:all" -ForegroundColor Gray
}

# 2. Linting
Write-Host "2. Running linter..."
try {
    pnpm lint 2>&1 | Out-Null
    Write-Success "Linting passed"
} catch {
    Write-Failure "Linting failed"
    Write-Host "   Run: pnpm lint" -ForegroundColor Gray
}

# 3. Tests
Write-Host "3. Running tests..."
try {
    pnpm --filter cms test 2>&1 | Out-Null
    Write-Success "Tests passed"
} catch {
    Write-Failure "Tests failed"
    Write-Host "   Run: pnpm --filter cms test" -ForegroundColor Gray
}

# 4. Build
Write-Host "4. Building applications..."
try {
    pnpm build 2>&1 | Out-Null
    Write-Success "Build successful"
} catch {
    Write-Failure "Build failed"
    Write-Host "   Run: pnpm build" -ForegroundColor Gray
}

# 5. Security Audit
Write-Host "5. Running security audit..."
try {
    $auditOutput = pnpm audit --audit-level=high --json 2>&1 | ConvertFrom-Json
    $critical = $auditOutput.metadata.vulnerabilities.critical
    $high = $auditOutput.metadata.vulnerabilities.high
    
    if ($critical -eq 0) {
        Write-Success "No critical vulnerabilities"
    } else {
        Write-Failure "Critical vulnerabilities found: $critical"
    }
    
    if ($high -gt 5) {
        Write-Warning "High vulnerabilities found: $high (may be React 19 peer deps)"
    }
} catch {
    Write-Warning "Could not run security audit"
}

# 6. Environment Variables Check
Write-Host "6. Checking environment variables..."
if (Test-Path ".env.template") {
    Write-Success "Environment template exists"
} else {
    Write-Warning "Environment template not found"
}

# 7. Documentation Check
Write-Host "7. Checking documentation..."
$docs = @(
    "docs/DEPLOYMENT-RUNBOOK.md",
    "docs/LAUNCH-CHECKLIST.md",
    "docs/ENVIRONMENT-VARIABLES-GUIDE.md",
    "SECURITY.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Success "Documentation exists: $doc"
    } else {
        Write-Warning "Missing documentation: $doc"
    }
}

# 8. Health Check Endpoint
Write-Host "8. Verifying health check endpoint..."
if (Test-Path "apps/cms/src/app/api/health/route.ts") {
    Write-Success "Health check endpoint exists"
} else {
    Write-Failure "Health check endpoint missing"
}

# Summary
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Validation Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Passed: $PASSED" -ForegroundColor Green
Write-Host "Failed: $FAILED" -ForegroundColor Red
Write-Host "Warnings: $WARNINGS" -ForegroundColor Yellow
Write-Host ""

if ($FAILED -eq 0) {
    if ($WARNINGS -eq 0) {
        Write-Host "✅ All checks passed! Ready for launch." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "⚠️  Checks passed with warnings. Review warnings before launch." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "❌ Some checks failed. Fix issues before launch." -ForegroundColor Red
    exit 1
}

