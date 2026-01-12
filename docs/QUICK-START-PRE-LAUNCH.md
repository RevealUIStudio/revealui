# Quick Start: Pre-Launch Execution

**Time Required**: 5 minutes to get started  
**Purpose**: Quick reference for executing pre-launch validation

---

## 1. Run Validation Script

**All Platforms** (Cross-platform TypeScript):
```bash
pnpm validate:pre-launch
```

This will check:
- ✅ Type checking
- ✅ Linting
- ✅ Tests
- ✅ Build
- ✅ Security audit
- ✅ Documentation
- ✅ Health checks

---

## 2. Check Test Coverage

```bash
cd apps/cms
pnpm test:coverage
```

Review the coverage report and ensure:
- Statements: ≥ 70%
- Branches: ≥ 60%
- Functions: ≥ 70%
- Lines: ≥ 70%

---

## 3. Run Security Tests

**All Platforms** (Cross-platform TypeScript):
```bash
pnpm validate:security
```

Or with custom base URL:
```bash
BASE_URL=https://staging.your-domain.com pnpm validate:security
```

---

## 4. Check for Console Statements

**All Platforms** (Cross-platform TypeScript):
```bash
pnpm validate:console
```

---

## 5. Review Launch Checklist

Open and complete: `docs/LAUNCH-CHECKLIST.md`

---

## Next Steps

1. Follow the full execution guide: `docs/PRE-LAUNCH-EXECUTION-GUIDE.md`
2. Run load tests on staging
3. Complete penetration testing
4. Final validation before production

---

**For detailed instructions, see**: `docs/PRE-LAUNCH-EXECUTION-GUIDE.md`

