# Secrets Management Guide

## ✅ Current Security Status

**Git History:** Clean - No secrets ever committed
**Last Audit:** 2026-02-03
**Protection Level:** Enhanced with pre-commit hooks

---

## 🔒 Secret Storage Strategy

### Local Development
```bash
# ✅ DO: Store in .env.development.local (gitignored)
REVEALUI_SECRET=your-32-char-secret-here
STRIPE_SECRET_KEY=sk_live_...
POSTGRES_URL=postgresql://user:pass@host/db

# ❌ DON'T: Commit to git
# ❌ DON'T: Share in Slack/Discord
# ❌ DON'T: Store in version control
```

### Production (Vercel)
```bash
# Use Vercel's dashboard or CLI to set secrets
vercel env add REVEALUI_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add POSTGRES_URL production
```

### CI/CD (GitHub Actions)
```bash
# Set in GitHub Settings → Secrets and variables → Actions
# Access with: ${{ secrets.SECRET_NAME }}
```

---

## 🛡️ Protection Layers

### 1. Git Pre-Commit Hook
**Location:** `.git/hooks/pre-commit`
**Function:** Scans staged files for secret patterns before commit
**Patterns Detected:**
- Stripe live keys (`sk_live_`, `pk_live_`)
- Webhook secrets (`whsec_`)
- Database URLs with credentials
- AWS access keys
- OpenAI API keys
- Production REVEALUI_SECRET values

**Bypass:** Only if absolutely necessary:
```bash
git commit --no-verify  # USE WITH EXTREME CAUTION
```

### 2. GitHub Secret Scanning (Gitleaks)
**Workflow:** `.github/workflows/secrets-scan.yml`
**Runs:** On every push and pull request
**Tool:** Gitleaks v2 (industry standard)
**Scope:** Scans entire git history

### 3. .gitignore Protection
**Protected Files:**
```
.env
.env*.local
.env.development.local
.env.production.local
.env.test.local
```

**Safe to Commit:**
```
.env.template      # Template with placeholders
.env.test          # Test values only
*.env.example      # Example files
```

### 4. File Permissions
**Set secure permissions:**
```bash
chmod 600 .env*    # Owner read/write only
```

**Current permissions:**
- `.env`: 600 (secure) ✅
- `.env.development.local`: 600 (secure) ✅
- `.env.test.local`: 600 (secure) ✅

---

## 📋 Environment Files Inventory

| File | Purpose | Git Tracked | Has Secrets |
|------|---------|-------------|-------------|
| `.env` | Local development | ❌ No | ✅ Yes |
| `.env.development.local` | Dev overrides | ❌ No | ✅ Yes |
| `.env.test.local` | Test overrides | ❌ No | ✅ Yes |
| `.env.template` | Template/documentation | ✅ Yes | ❌ No |
| `.env.test` | Test defaults | ✅ Yes | ❌ No (test values) |
| `.envrc` | Direnv config | ✅ Yes | ❌ No |

---

## 🔄 Secret Rotation Policy

### When to Rotate Secrets

**IMMEDIATE rotation required if:**
- Secret accidentally committed to git
- Secret shared in plaintext (email, Slack, etc.)
- Team member with access leaves
- Suspected compromise or breach
- Service provider recommends rotation

**Scheduled rotation (recommended):**
- JWT secrets: Every 90 days
- API keys: Every 180 days
- Database credentials: Every 180 days
- Webhook secrets: Every 180 days

### How to Rotate Secrets

#### 1. Stripe Keys
```bash
# 1. Generate new keys in Stripe Dashboard
# 2. Update .env files
STRIPE_SECRET_KEY=sk_live_NEW_KEY
STRIPE_WEBHOOK_SECRET=whsec_NEW_SECRET

# 3. Update Vercel
vercel env rm STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY production

# 4. Redeploy
vercel --prod

# 5. Delete old keys in Stripe Dashboard
```

#### 2. Database Credentials
```bash
# 1. Create new credentials in Neon/provider
# 2. Update .env files
POSTGRES_URL=postgresql://newuser:newpass@host/db

# 3. Update Vercel
vercel env rm POSTGRES_URL production
vercel env add POSTGRES_URL production

# 4. Redeploy and verify
vercel --prod

# 5. Delete old credentials
```

#### 3. REVEALUI_SECRET (JWT)
```bash
# 1. Generate new 32+ char secret
openssl rand -base64 32

# 2. Update .env files
REVEALUI_SECRET=new-32-char-secret-here

# 3. Update Vercel
vercel env rm REVEALUI_SECRET production
vercel env add REVEALUI_SECRET production

# 4. Redeploy (will invalidate all existing sessions)
vercel --prod
```

---

## 🚨 Incident Response

### If Secret is Committed to Git

**DO NOT:**
- ❌ Just delete the file and commit again (still in history!)
- ❌ Use `git commit --amend` (only fixes last commit)
- ❌ Ignore it hoping nobody notices

**DO:**
1. **Immediately rotate the exposed secret** (see rotation guide above)
2. **Review git history:**
   ```bash
   git log --all --full-history -- .env
   ```
3. **Contact security team** if public repository
4. **Document the incident** in incident log

**If secret is in recent commits only:**
```bash
# If on a feature branch and not pushed to main:
git reset --hard origin/main  # Discard local commits
```

**If secret is in pushed commits:**
```bash
# Contact your team immediately
# May require force push or BFG Repo-Cleaner
# Rotate secrets FIRST before cleaning history
```

### If Secret is Shared Publicly

1. **Rotate immediately** (within 5 minutes)
2. **Check for unauthorized access:**
   - Stripe: Check dashboard for suspicious charges
   - Database: Review connection logs
   - API: Check for unusual traffic
3. **Enable 2FA** on all affected services
4. **Review audit logs** for the past 30 days
5. **Document and report** to security team

---

## 🔍 Auditing Secrets

### Check Current Status
```bash
# Run the audit script
./scripts/security/audit-env-files.sh

# Verify .gitignore is working
git check-ignore -v .env
git check-ignore -v .env.development.local

# Check for secrets in git history
git log --all --full-history -- .env
git grep -i "sk_live_" $(git rev-list --all)
```

### Verify Pre-commit Hook
```bash
# Test the hook
echo "STRIPE_SECRET_KEY=sk_live_test" > test-secret.txt
git add test-secret.txt
git commit -m "test"  # Should be blocked
rm test-secret.txt
git reset
```

---

## 📚 Best Practices

### ✅ DO:
- Use environment-specific files (`.env.local` for dev)
- Store production secrets in Vercel/hosting platform
- Use `chmod 600` for all `.env` files
- Rotate secrets on a schedule
- Use different secrets for dev/staging/prod
- Document which secrets are required
- Use secret management tools (Vercel, AWS Secrets Manager)
- Run `pnpm env:validate` to check required vars

### ❌ DON'T:
- Commit `.env` files to git
- Share secrets in plaintext (email, Slack, Discord)
- Use production secrets in development
- Hardcode secrets in source code
- Use weak/short secrets (min 32 chars for JWT)
- Reuse secrets across environments
- Leave default/example secrets in production
- Skip pre-commit hooks with `--no-verify`

---

## 🔧 Required Secrets by Environment

### Development (.env.development.local)
```bash
# Core (required)
REVEALUI_SECRET=min-32-chars-for-jwt-signing
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000

# Database (required)
POSTGRES_URL=postgresql://user:pass@localhost:5432/revealui_dev

# Stripe (test keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Storage (optional for local dev)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

### Production (Vercel Environment Variables)
```bash
# Core (required)
REVEALUI_SECRET=production-secret-min-32-chars
REVEALUI_PUBLIC_SERVER_URL=https://your-domain.com

# Database (required)
POSTGRES_URL=postgresql://user:pass@production-host/db

# Stripe (live keys - NEVER test keys!)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Storage (required)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Monitoring (recommended)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
```

---

## 📞 Emergency Contacts

**If you discover a security incident:**
1. Rotate affected secrets immediately
2. Contact team lead
3. Review access logs
4. Document in incident log: `docs/incidents/YYYY-MM-DD-secret-exposure.md`

---

## 🔗 Resources

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [GitHub Secrets Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Last Updated:** 2026-02-03
**Next Audit Due:** 2026-03-03
