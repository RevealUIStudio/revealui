# Environment Setup for RevealUI Framework

**Purpose**: Complete guide to setting up development environment including Docker, WSL2, known limitations, and launch checklist
**Last Updated**: January 2025

---

## Table of Contents

1. [Docker Engine Setup on WSL2](#docker-engine-setup-on-wsl2)
2. [Known Limitations](#known-limitations)
3. [Pre-Launch Checklist](#pre-launch-checklist)

---

## Docker Engine Setup on WSL2

**Purpose**: Set up Docker Engine directly on WSL2 without Docker Desktop
**OS**: WSL2 (Ubuntu/Debian)

### Overview

Docker Desktop is heavy and requires Windows. You can run Docker Engine directly on WSL2, which is lighter and faster.

### Prerequisites

- WSL2 installed and running
- Ubuntu/Debian distribution in WSL2
- Sudo access

### Installation Steps

#### Step 1: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

#### Step 2: Install Prerequisites

```bash
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

#### Step 3: Add Docker's Official GPG Key

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

#### Step 4: Set Up Docker Repository

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

#### Step 5: Install Docker Engine

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### Step 6: Start Docker Service

```bash
sudo service docker start
```

#### Step 7: Add Your User to Docker Group (Optional but Recommended)

```bash
sudo usermod -aG docker $USER
```

**Important**: You'll need to log out and log back in (or restart WSL) for group changes to take effect.

#### Step 8: Verify Installation

```bash
docker --version
docker compose version
sudo docker run hello-world
```

### Auto-Start Docker on WSL2

Docker doesn't auto-start on WSL2. Add this to your `~/.bashrc` or `~/.zshrc`:

```bash
# Auto-start Docker on WSL2
if ! pgrep -x "dockerd" > /dev/null; then
    sudo service docker start > /dev/null 2>&1
fi
```

Or create a systemd service (if you have systemd enabled in WSL2):

```bash
# Check if systemd is enabled
systemctl --version

# If systemd is available, enable Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### Fix Docker Credential Issue

If you see the credential error, remove the credential helper:

```bash
# Check Docker config
cat ~/.docker/config.json

# Remove credential helper (if present)
# Edit ~/.docker/config.json and remove:
#   "credsStore": "desktop.exe"
#   or
#   "credHelpers": { ... }
```

Or create/update `~/.docker/config.json`:

```json
{
  "auths": {}
}
```

### Verify Setup

```bash
# Check Docker is running
sudo service docker status

# Test Docker
docker ps

# Test Docker Compose
docker compose version

# Test with our test database
cd /home/joshua-v-dev/projects/RevealUI
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml down
```

### Troubleshooting

#### Docker Service Not Starting

```bash
# Check Docker service status
sudo service docker status

# Start Docker manually
sudo service docker start

# Check logs
sudo journalctl -u docker
# or
sudo tail -f /var/log/docker.log
```

#### Permission Denied

```bash
# Add user to docker group (if not done)
sudo usermod -aG docker $USER

# Log out and back in, or restart WSL
# Then verify:
groups
# Should include "docker"
```

#### Port Already in Use

```bash
# Check what's using the port
sudo netstat -tulpn | grep 5433

# Or use lsof
sudo lsof -i :5433

# Kill the process or change port in docker-compose.test.yml
```

#### WSL2 Integration Issues

If Docker Desktop was previously installed, you might need to:

1. **Uninstall Docker Desktop** (if installed)
2. **Remove old Docker configs**:
   ```bash
   rm -rf ~/.docker
   ```
3. **Follow installation steps above**

### Quick Setup Script

Save this as `setup-docker-wsl2.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up Docker Engine on WSL2..."

# Update system
sudo apt update
sudo apt upgrade -y

# Install prerequisites
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
sudo service docker start

# Add user to docker group
sudo usermod -aG docker $USER

# Fix credential helper
mkdir -p ~/.docker
cat > ~/.docker/config.json <<EOF
{
  "auths": {}
}
EOF

echo ""
echo "✅ Docker Engine installed!"
echo ""
echo "⚠️  IMPORTANT: Log out and log back in (or restart WSL) for group changes to take effect."
echo ""
echo "Then verify with:"
echo "  docker --version"
echo "  docker compose version"
echo "  docker ps"
```

Make it executable:
```bash
chmod +x setup-docker-wsl2.sh
./setup-docker-wsl2.sh
```

### After Installation

#### 1. Restart WSL (or log out/in)

```bash
# In Windows PowerShell/CMD:
wsl --shutdown

# Then restart WSL
```

#### 2. Verify Docker Works

```bash
docker --version
docker compose version
docker ps
```

#### 3. Test Our Setup

```bash
cd /home/joshua-v-dev/projects/RevealUI

# Start test database
./scripts/setup-test-db.sh

# Or manually:
docker compose -f docker-compose.test.yml up -d
```

### Benefits of Docker Engine vs Docker Desktop

#### Docker Engine (WSL2)
- ✅ Lighter weight
- ✅ Faster startup
- ✅ No Windows dependency
- ✅ Native Linux experience
- ✅ Better for CI/CD
- ✅ Free (no license concerns)

#### Docker Desktop
- ❌ Heavy (requires Windows)
- ❌ Slower startup
- ❌ License restrictions for large companies
- ❌ More GUI overhead

### Next Steps

After Docker is set up:

1. **Test our automation**:
   ```bash
   ./scripts/setup-test-db.sh
   ```

2. **Run integration tests**:
   ```bash
   export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"
   pnpm --filter @revealui/memory test __tests__/integration/automated-validation.test.ts
   ```

3. **Run full validation**:
   ```bash
   ./scripts/run-automated-validation.sh
   ```

### References

- [Docker Engine Installation - Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker on WSL2](https://docs.docker.com/desktop/wsl/)
- [Docker Compose Installation](https://docs.docker.com/compose/install/)

---

## Known Limitations

This section tracks known limitations, workarounds, and future improvements for the RevealUI Framework.

### Type System

#### `any` Types in Core
- **Location**: `packages/core/src/core/__internal/index.ts`, `packages/core/src/core/gaurds/validators/hasProp.ts`
- **Status**: Reduced from 297 to ~18 instances in core files
- **Impact**: Low - mostly in internal type guards
- **Workaround**: Type assertions are safe in these contexts
- **Future**: Complete type definitions for all file types

#### TODO Comments
- **Count**: 77 TODO/FIXME/HACK comments across 38 files
- **Priority**: Most are non-critical (eventually/v1-release tags)
- **Critical**: 10 TODOs in `getPageContextFromHooks.ts` related to V1 design migration
- **Action**: Documented in code, will be addressed in V1 release

### Plugin System

#### Plugin Integration
- **Status**: Plugin system created but not fully integrated into Vite build
- **Impact**: Medium - plugins work but require manual Vite plugin conversion
- **Workaround**: Use `toVitePlugins()` method to convert RevealUI plugins
- **Future**: Automatic integration in Vite build process

#### Configuration Merging
- **Status**: Unified config system created but not fully integrated
- **Impact**: Low - works alongside existing `+config.ts` files
- **Workaround**: Use `extends` option to merge with existing configs
- **Future**: Full integration with automatic merging

### Type Generation

#### Watch Mode
- **Status**: Implemented with polling (2-second interval)
- **Limitation**: Not using file system watchers (chokidar)
- **Impact**: Low - works but less efficient than native watchers
- **Future**: Migrate to chokidar for better performance

#### RevealUI CMS Type Mapping
- **Status**: Basic type mapping implemented
- **Limitation**: Complex types (blocks, groups) map to `unknown[]` or `Record<string, unknown>`
- **Impact**: Medium - requires manual type definitions for complex fields
- **Future**: Enhanced type inference from RevealUI CMS schemas

### Performance

#### Bundle Size
- **Current**: ~45MB (includes source maps)
- **Production**: 6.6 MB compressed
- **Status**: Acceptable but could be optimized
- **Future**: Tree-shaking improvements, code splitting

#### Build Time
- **Current**: ~8-12 seconds for packages
- **Status**: Good performance
- **Future**: Parallel builds, caching improvements

### Testing

#### Test Coverage
- **Current**: Coverage thresholds set (70%/60%/70%)
- **Status**: Tests implemented but coverage not yet at thresholds
- **Impact**: Low - tests are comprehensive
- **Future**: Increase coverage to meet thresholds

#### E2E Tests
- **Status**: Basic E2E tests implemented
- **Limitation**: Limited to critical user flows
- **Future**: Expand to cover all user journeys

### Compliance

#### GDPR
- **Status**: Cookie consent, data export/deletion implemented
- **Limitation**: Data retention policies not configurable
- **Future**: Configurable retention policies

#### WCAG 2.1
- **Status**: Accessibility utilities created
- **Limitation**: Not all components have ARIA labels
- **Future**: Audit all components and add missing labels

### Documentation

#### API Documentation
- **Status**: Core APIs documented
- **Limitation**: Some edge cases not covered
- **Future**: Complete examples for all APIs

#### Migration Guides
- **Status**: Basic guides created
- **Limitation**: Step-by-step examples needed
- **Future**: Interactive migration tool

### Workarounds

#### PGlite for Local Development
- **Workaround**: Use PGlite (in-memory PostgreSQL) for local development and testing
- **Status**: Implemented and working
- **Note**: Production uses full PostgreSQL (Neon, Supabase, etc.)

#### Build-Time Authentication
- **Workaround**: Mark routes as `dynamic = "force-dynamic"`
- **Status**: Working solution
- **Note**: Required for RevealUI CMS routes

### Future Improvements

1. **Type Safety**: Complete elimination of `any` types
2. **Plugin Integration**: Automatic Vite plugin conversion
3. **Type Generation**: Enhanced RevealUI CMS type inference
4. **Performance**: Bundle size optimization
5. **Testing**: Increase coverage to thresholds
6. **Documentation**: Complete all guides with examples
7. **Compliance**: Configurable GDPR policies
8. **Accessibility**: Full WCAG 2.1 AA compliance audit

### Reporting Issues

If you encounter limitations not listed here:
1. Check existing GitHub issues
2. Create a new issue with:
   - Description of limitation
   - Expected behavior
   - Actual behavior
   - Workaround (if any)

---

## Pre-Launch Checklist

**Last Updated**: January 2025
**Status**: Pre-Production Validation

This checklist ensures all critical items are verified before production launch.

### Phase 1: Testing & Quality Assurance

#### Test Coverage
- [ ] Test coverage meets thresholds:
  - [ ] Statements: ≥ 70%
  - [ ] Branches: ≥ 60%
  - [ ] Functions: ≥ 70%
  - [ ] Lines: ≥ 70%
- [ ] Critical path coverage (auth, payments, access control): ≥ 90%
- [ ] Coverage report generated and reviewed

#### Test Execution
- [ ] All unit tests passing: `pnpm --filter cms test`
- [ ] All integration tests passing
- [ ] All E2E tests passing: `pnpm --filter test test:e2e`
- [ ] Test pass rate: 100%

#### Test Implementation
- [ ] Authentication tests fully implemented (14 tests)
- [ ] Access control tests fully implemented (27 tests)
- [ ] Payment processing tests fully implemented (33 tests)
- [ ] E2E tests expanded with critical flows:
  - [ ] User registration and login
  - [ ] Admin panel access
  - [ ] Payment checkout flow
  - [ ] Form submissions
  - [ ] Multi-tenant isolation

### Phase 2: Performance & Load Testing

#### Load Testing
- [ ] Load testing scripts created in `packages/test/load-tests/`
- [ ] Authentication load test run and passed
- [ ] API endpoint load test run and passed
- [ ] Payment processing load test run and passed
- [ ] Baseline metrics established

#### Performance Budgets
- [ ] Interactive: < 3000ms (validated)
- [ ] First meaningful paint: < 1000ms (validated)
- [ ] Largest contentful paint: < 2500ms (validated)
- [ ] Script size: < 300KB (validated)
- [ ] Total page size: < 1000KB (validated)

#### Performance Optimization
- [ ] Performance bottlenecks identified and fixed
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] Bundle size optimized

### Phase 3: Security Validation

#### Security Audit
- [ ] Security audit run: `pnpm audit --audit-level=high`
- [ ] 0 critical vulnerabilities confirmed
- [ ] High vulnerabilities documented and assessed
- [ ] Security testing script run: `bash scripts/security-test.sh`

#### Penetration Testing
- [ ] Rate limiting tested and verified
- [ ] SQL injection prevention tested
- [ ] XSS prevention tested
- [ ] CSRF protection verified
- [ ] Authentication bypass attempts tested
- [ ] Authorization checks verified
- [ ] Multi-tenant isolation tested

#### Security Configuration
- [ ] Security headers configured and verified
- [ ] CORS properly configured
- [ ] Rate limiting enabled on auth endpoints
- [ ] Input validation with Zod schemas verified
- [ ] Webhook signature verification tested

### Phase 4: Monitoring & Observability

#### Sentry Configuration
- [ ] Sentry client config verified: `apps/cms/sentry.client.config.ts`
- [ ] Sentry server config verified: `apps/cms/sentry.server.config.ts`
- [ ] Sentry DSN configured in environment variables
- [ ] Error reporting tested
- [ ] Performance monitoring enabled
- [ ] Alerts configured for critical errors

#### Health Checks
- [ ] Health endpoint accessible: `/api/health`
- [ ] Health endpoint returns correct structure
- [ ] Readiness probe working: `/api/health/ready`
- [ ] System metrics included in health check

#### Uptime Monitoring
- [ ] Uptime monitoring service configured (if applicable)
- [ ] Alert thresholds set
- [ ] On-call rotation configured

### Phase 5: Environment & Configuration

#### Environment Variables
- [ ] All required environment variables set in production
- [ ] `REVEALUI_SECRET` is cryptographically strong (32+ chars)
- [ ] `REVEALUI_PUBLIC_SERVER_URL` set to production URL
- [ ] `DATABASE_URL` configured for production
- [ ] Database connection string verified
- [ ] Stripe keys configured (production keys)
- [ ] Vercel Blob token configured
- [ ] All secrets verified (not exposed in code)

#### Database
- [ ] Database migrations up to date
- [ ] Database backup created
- [ ] Connection pooling configured
- [ ] Database performance tested

#### Build & Deployment
- [ ] Production build successful: `pnpm build`
- [ ] Type checking passes: `pnpm typecheck:all`
- [ ] Linting passes: `pnpm lint`
- [ ] No console.log statements in production code
- [ ] Source maps configured (if needed)

### Phase 6: Documentation

#### Documentation Review
- [ ] Deployment runbook reviewed: `docs/DEPLOYMENT_RUNBOOK.md`
- [ ] Environment variables guide complete: `docs/ENVIRONMENT_VARIABLES_GUIDE.md`
- [ ] Testing strategy documented: `docs/TESTING_STRATEGY.md`
- [ ] Security policy reviewed: `SECURITY.md`
- [ ] Known limitations documented: `docs/KNOWN_LIMITATIONS.md`

#### Runbook & Procedures
- [ ] Rollback procedure documented and tested
- [ ] Incident response plan ready
- [ ] On-call contacts documented
- [ ] Escalation procedures defined

### Phase 7: Staging Validation

#### Staging Environment
- [ ] Staging environment deployed
- [ ] All critical user flows tested in staging:
  - [ ] User registration
  - [ ] User login
  - [ ] Admin panel access
  - [ ] Payment processing
  - [ ] Form submissions
  - [ ] Multi-tenant isolation
- [ ] Performance validated in staging
- [ ] Security tests run in staging

#### Integration Testing
- [ ] Stripe integration tested (test mode)
- [ ] Vercel Blob storage tested
- [ ] Database connectivity verified
- [ ] External service integrations verified

### Phase 8: Final Pre-Launch

#### Code Quality
- [ ] All linter errors resolved
- [ ] All TypeScript errors resolved
- [ ] Code review completed
- [ ] Dead code removed
- [ ] Technical debt documented

#### Final Checks
- [ ] All tests passing: `pnpm test`
- [ ] Build successful: `pnpm build`
- [ ] Type checking passes: `pnpm typecheck:all`
- [ ] Security audit clean: `pnpm audit --audit-level=high`
- [ ] Performance budgets met
- [ ] Load testing passed

#### Communication
- [ ] Launch communication plan prepared
- [ ] Stakeholders notified
- [ ] Support team briefed
- [ ] Monitoring dashboards ready

### Post-Launch Monitoring (First 24 Hours)

#### Immediate Monitoring
- [ ] Error rates monitored (target: < 0.1%)
- [ ] Performance metrics watched (p95, p99)
- [ ] Payment processing verified
- [ ] Authentication flows verified
- [ ] Sentry alerts monitored
- [ ] Health check endpoints monitored

#### Issue Response
- [ ] On-call team ready
- [ ] Rollback procedure ready
- [ ] Hotfix process documented
- [ ] Communication channels open

### Sign-Off

**Prepared by**: _________________
**Date**: _________________
**Approved by**: _________________
**Date**: _________________

### Notes

- This checklist should be completed before production deployment
- Any items marked as failed should be addressed before launch
- Document any exceptions or known issues
- Keep this checklist updated as requirements change

### Next Steps After Launch

1. Monitor first 24 hours closely
2. Review performance metrics daily for first week
3. Collect user feedback
4. Address any issues promptly
5. Plan post-launch optimizations

---

## Related Documentation

- [Quick Start](./QUICK_START.md) - Get started in 5 minutes
- [Overview](./OVERVIEW.md) - Comprehensive framework overview
- [CMS Guide](./CMS_GUIDE.md) - Complete CMS documentation
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) - Production deployment
- [Environment Variables Guide](../development/ENVIRONMENT_VARIABLES_GUIDE.md) - Complete configuration guide
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Status**: Ready for Development

**Last Updated**: January 2025
**Maintainer**: RevealUI Team
