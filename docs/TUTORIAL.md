# RevealUI Developer Tutorial

Complete hands-on tutorial for new developers joining the RevealUI project.

## Welcome! 👋

This tutorial will guide you from zero to your first contribution in about 2 hours. By the end, you'll:

- ✅ Have a fully working development environment
- ✅ Understand the project structure
- ✅ Know how to use the CLI tools
- ✅ Be ready to make your first contribution

**Time Required:** ~2 hours

**Prerequisites:**
- Basic knowledge of React and TypeScript
- Node.js 24.12.0+ installed
- Git installed
- A code editor (VS Code recommended)

---

## Table of Contents

1. [Environment Setup](#part-1-environment-setup-30-minutes)
2. [Exploring the Codebase](#part-2-exploring-the-codebase-20-minutes)
3. [Making Changes](#part-3-making-changes-30-minutes)
4. [Using CLI Tools](#part-4-using-cli-tools-20-minutes)
5. [Your First Contribution](#part-5-your-first-contribution-20-minutes)

---

## Part 1: Environment Setup (30 minutes)

### Step 1: Fork and Clone

**Fork the repository:**
1. Visit https://github.com/RevealUIStudio/revealui
2. Click "Fork" in the top-right
3. Wait for GitHub to create your fork

**Clone your fork:**
```bash
git clone https://github.com/YOUR_USERNAME/revealui.git
cd revealui
```

**Add upstream remote:**
```bash
git remote add upstream https://github.com/RevealUIStudio/revealui.git
```

**Verify:**
```bash
git remote -v
# Should show:
# origin    https://github.com/YOUR_USERNAME/revealui.git (fetch)
# origin    https://github.com/YOUR_USERNAME/revealui.git (push)
# upstream  https://github.com/RevealUIStudio/revealui.git (fetch)
# upstream  https://github.com/RevealUIStudio/revealui.git (push)
```

### Step 2: Install Dependencies

**Install pnpm** (if not already installed):
```bash
npm install -g pnpm@9.14.2
```

**Install project dependencies:**
```bash
pnpm install
```

**Expected output:**
```
Progress: resolved X, reused Y, downloaded Z, added W
Done in Xs
```

**If you see warnings:** That's normal! The project suppresses deprecation warnings.

### Step 3: Set Up Environment Variables

**Copy the template:**
```bash
cp .env.template .env.development.local
```

**Edit `.env.development.local`:**
```bash
# Open in your editor
code .env.development.local  # VS Code
# or
vim .env.development.local   # Vim
# or
nano .env.development.local  # Nano
```

**Required variables:**

For local development, you need:

```env
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/revealui"

# Or use NeonDB (free tier)
# DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/revealui?sslmode=require"

# Vercel Blob (required for CMS media)
BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# RevealUI (required)
PAYLOAD_SECRET="your-secret-here-min-32-chars"
```

**Get NeonDB credentials** (free):
1. Visit https://console.neon.tech
2. Create account (free)
3. Create new project
4. Copy connection string → `DATABASE_URL`

**Get Vercel Blob** (free):
1. Visit https://vercel.com/dashboard
2. Create account (free)
3. Create new project
4. Settings → Storage → Create Blob Store
5. Copy token → `BLOB_READ_WRITE_TOKEN`

**Generate PayloadSecret:**
```bash
# Generate random 32+ character string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output → PAYLOAD_SECRET
```

### Step 4: Initialize Database

```bash
pnpm db:init
```

**Expected output:**
```
🗄️  Initializing database...
✅ Database initialized
✅ Schema applied
✅ Ready for migrations
```

**Run migrations:**
```bash
pnpm db:migrate
```

**Seed test data:**
```bash
pnpm db:seed
```

**Verify:**
```bash
pnpm db:status
```

**Should show:**
```
✅ Database connected
📊 Tables: 15
📝 Migrations: 8 applied
```

### Step 5: Start Development Server

```bash
pnpm dev
```

**Expected output:**
```
@revealui/cms:dev: ready started server on 0.0.0.0:4000
@revealui/web:dev: ready started server on 0.0.0.0:3000
@revealui/dashboard:dev: ready started server on 0.0.0.0:3002
```

**Open in browser:**
- CMS: http://localhost:4000/admin
- Web: http://localhost:3000
- Dashboard: http://localhost:3002

**Create admin user:**
1. Go to http://localhost:4000/admin
2. Click "Create your first user"
3. Fill in:
   - Email: `admin@example.com`
   - Password: `password` (change later!)
4. Click "Create"

**✅ Success!** You now have a working dev environment.

---

## Part 2: Exploring the Codebase (20 minutes)

### Project Structure

```
revealui/
├── apps/                   # Applications
│   ├── cms/               # RevealUI CMS (port 4000)
│   ├── web/               # Main website (port 3000)
│   ├── dashboard/         # Admin dashboard (port 3002)
│   ├── docs/              # Documentation site
│   └── landing/           # Landing page
│
├── packages/              # Shared packages
│   ├── core/             # Core utilities
│   ├── auth/             # Authentication
│   ├── db/               # Database layer
│   ├── ai/               # AI integrations
│   ├── sync/             # Data synchronization
│   └── services/         # Third-party services
│
├── scripts/               # Development scripts
│   ├── cli/              # CLI tools
│   ├── commands/         # Command implementations
│   ├── lib/              # Shared libraries
│   └── gates/            # Quality gates
│
├── package-templates/     # Package.json templates
│   ├── library.json      # For libraries
│   ├── app.json          # For apps
│   └── tool.json         # For CLI tools
│
└── docs/                  # Documentation
    ├── QUICK_START.md
    ├── MIGRATION_GUIDE.md
    └── examples/cli-demos/
```

### Using the Explorer

**Launch the script explorer:**
```bash
pnpm explore
```

**You'll see:**
```
📦 RevealUI Script Explorer
===========================

Categories:
  1. Build & Development
  2. Code Quality
  3. Testing
  4. Database Operations
  5. Analysis & Metrics
  6. Maintenance & Fixes
  7. Release Management
  8. Validation
  9. Documentation

Select a category (1-9) or 'q' to quit:
```

**Try exploring different categories:**
- Press `1` to see build scripts
- Press `2` to see quality tools
- Press `q` to quit

**Search for scripts:**
```bash
pnpm explore:search test
```

**List all scripts:**
```bash
pnpm explore:list
```

### Understanding Packages

**View package dependencies:**
```bash
pnpm list --depth=0
```

**Check a specific package:**
```bash
cd packages/core
cat package.json
```

**Notice the standard scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  }
}
```

**All packages follow this pattern!**

---

## Part 3: Making Changes (30 minutes)

### Exercise 1: Fix a Typo

**Find a file to edit:**
```bash
# Let's edit the core package README
code packages/core/README.md
```

**Make a small change:**
```markdown
# Before
RevealUI Core utilities

# After
RevealUI Core - Essential utilities for the framework
```

**Save the file.**

**Check what changed:**
```bash
git diff
```

**Validate the change:**
```bash
pnpm lint
pnpm typecheck:all
```

**Commit the change:**
```bash
git add packages/core/README.md
git commit -m "docs: improve core package description"
```

### Exercise 2: Add a New Utility Function

**Create a new file:**
```bash
code packages/core/src/utils/greet.ts
```

**Add code:**
```typescript
/**
 * Generates a greeting message
 * @param name - The name to greet
 * @returns A friendly greeting
 */
export function greet(name: string): string {
  if (!name || name.trim() === '') {
    throw new Error('Name cannot be empty');
  }
  return `Hello, ${name}!`;
}
```

**Export the function:**
```bash
code packages/core/src/utils/index.ts
```

**Add export:**
```typescript
export * from './greet.js';  // Note the .js extension!
```

**Write a test:**
```bash
code packages/core/src/__tests__/greet.test.ts
```

**Add test code:**
```typescript
import { describe, it, expect } from 'vitest';
import { greet } from '../utils/greet.js';

describe('greet', () => {
  it('should return a greeting', () => {
    expect(greet('World')).toBe('Hello, World!');
  });

  it('should throw on empty name', () => {
    expect(() => greet('')).toThrow('Name cannot be empty');
  });

  it('should trim whitespace', () => {
    expect(() => greet('   ')).toThrow('Name cannot be empty');
  });
});
```

**Run tests:**
```bash
pnpm --filter @revealui/core test
```

**Expected output:**
```
✓ src/__tests__/greet.test.ts (3)
  ✓ greet (3)
    ✓ should return a greeting
    ✓ should throw on empty name
    ✓ should trim whitespace

Test Files  1 passed (1)
Tests  3 passed (3)
```

**Build the package:**
```bash
pnpm --filter @revealui/core build
```

**Verify:**
```bash
ls packages/core/dist
# Should see: greet.js, greet.d.ts
```

### Exercise 3: Use Your New Function

**Import in CMS:**
```bash
code apps/cms/src/app/test-greet/page.tsx
```

**Add code:**
```typescript
import { greet } from '@revealui/core';

export default function TestGreetPage() {
  const message = greet('RevealUI Developer');

  return (
    <div>
      <h1>{message}</h1>
    </div>
  );
}
```

**Visit in browser:**
```
http://localhost:4000/test-greet
```

**Should see:** "Hello, RevealUI Developer!"

---

## Part 4: Using CLI Tools (20 minutes)

### Tool 1: Script Validation

**Check all package scripts:**
```bash
pnpm scripts:validate
```

**Expected output:**
```
✅ Package Script Validation Report
====================================

📊 Summary:
   Total Packages:    21
   ✅ Passed:          21
   📈 Average Score:   97.9/100

✅ All packages meet script standards!
```

**Check a specific package:**
```bash
pnpm scripts:validate --package @revealui/core
```

### Tool 2: Code Quality Analysis

**Analyze code quality:**
```bash
pnpm analyze:quality
```

**Check TypeScript usage:**
```bash
pnpm analyze:types
```

**Find console statements:**
```bash
pnpm analyze:console
```

### Tool 3: Maintenance Tools

**Fix import extensions:**
```bash
# Preview changes
pnpm maintain:fix-imports --dry-run

# Apply fixes (if needed)
pnpm maintain:fix-imports
```

**Auto-fix linting:**
```bash
pnpm maintain:fix-lint
```

**Clean build artifacts:**
```bash
pnpm maintain:clean
```

### Tool 4: Performance Dashboard

**View system metrics:**
```bash
pnpm dashboard:summary
```

**Expected output:**
```
📊 Performance Summary
======================

🖥️  System:
   CPU Usage:     15.2%
   Memory Used:   2.1 GB / 16 GB

📈 Telemetry:
   Total Events:  156
   Recent Errors: 0

💾 Cache:
   Hit Rate:      72.5%
   Size:          128 MB
```

**Live monitoring:**
```bash
pnpm dashboard:watch
```

### Tool 5: Profiling

**Profile build performance:**
```bash
pnpm profile:build
```

**Profile tests:**
```bash
pnpm profile:test
```

---

## Part 5: Your First Contribution (20 minutes)

### Step 1: Choose an Issue

**Find a good first issue:**
1. Visit https://github.com/RevealUIStudio/revealui/issues
2. Filter by label: `good first issue`
3. Pick one that interests you
4. Comment: "I'd like to work on this!"

### Step 2: Create a Branch

```bash
# Update main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/your-feature-name
```

### Step 3: Make Your Changes

**Follow the workflow you learned:**
1. Make code changes
2. Write/update tests
3. Run validation:
   ```bash
   pnpm lint
   pnpm typecheck:all
   pnpm test
   pnpm scripts:validate
   ```

### Step 4: Commit Your Changes

**Follow conventional commits:**
```bash
git add .
git commit -m "feat: add amazing new feature

- Implemented X
- Added tests for Y
- Updated documentation"
```

**Commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance

### Step 5: Push and Create PR

**Push to your fork:**
```bash
git push origin feat/your-feature-name
```

**Create Pull Request:**
1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill in the PR template:
   - Title: Clear description
   - Description: What and why
   - Link to issue: "Fixes #123"
4. Submit!

**PR Checklist:**
- ✅ Tests pass (`pnpm test`)
- ✅ Linting passes (`pnpm lint`)
- ✅ Type checking passes (`pnpm typecheck:all`)
- ✅ Scripts validated (`pnpm scripts:validate`)
- ✅ Documentation updated
- ✅ Commit messages follow convention

### Step 6: Address Review Feedback

**When maintainers review:**
1. Make requested changes
2. Push to same branch:
   ```bash
   git add .
   git commit -m "fix: address review feedback"
   git push origin feat/your-feature-name
   ```
3. PR updates automatically

**After merge:**
```bash
# Update your main
git checkout main
git pull upstream main

# Delete feature branch
git branch -d feat/your-feature-name
```

---

## Next Steps

### Continue Learning

**Explore documentation:**
- [Quick Start Guide](QUICK_START.md) - Setup reference
- [Architecture Guide](ARCHITECTURE.md) - System design
- [Script Standards](../scripts/STANDARDS.md) - Package.json guidelines
- [Migration Guide](MIGRATION_GUIDE.md) - Recent changes

**Try the demos:**
- [Script Management Demo](../examples/cli-demos/script-management-demo.md)
- [Dashboard Demo](../examples/cli-demos/dashboard-demo.md)
- [Explorer Demo](../examples/cli-demos/explorer-demo.md)
- [Profiling Demo](../examples/cli-demos/profiling-demo.md)
- [Maintenance Demo](../examples/cli-demos/maintenance-demo.md)

### Join the Community

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)
- 🐛 [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)
- 📧 [Email](mailto:support@revealui.com)

### Advanced Topics

Once comfortable with basics, explore:
- **Database**: Learn Drizzle ORM ([Database Guide](DATABASE.md))
- **Testing**: Write comprehensive tests ([Testing Strategy](testing/TESTING-STRATEGY.md))
- **CI/CD**: Understand deployment ([CI/CD Guide](CI_CD_GUIDE.md))
- **Performance**: Optimize builds and tests

---

## Troubleshooting

### Issue: `pnpm install` fails

**Error:** "Cannot find module..."

**Solution:**
```bash
# Clean install
pnpm clean:install

# If still fails, check Node.js version
node --version  # Should be 24.12.0+
```

### Issue: Dev server won't start

**Error:** "Port 4000 already in use"

**Solution:**
```bash
# Find process using port
lsof -i :4000

# Kill it
kill -9 <PID>

# Or use different port
PORT=4001 pnpm dev:cms
```

### Issue: Database connection fails

**Error:** "Connection refused"

**Solution:**
```bash
# Check DATABASE_URL in .env.development.local
# Verify NeonDB is accessible
pnpm db:status
```

### Issue: Tests fail

**Error:** Various test failures

**Solution:**
```bash
# Clean everything
pnpm maintain:clean

# Fresh install
pnpm install

# Reset database
pnpm db:reset

# Try again
pnpm test
```

### Issue: TypeScript errors

**Error:** "Cannot find module '@revealui/core'"

**Solution:**
```bash
# Build packages first
pnpm build

# Then check types
pnpm typecheck:all
```

---

## Tips for Success

### Development Workflow

**Daily routine:**
```bash
# Morning: Update main
git checkout main && git pull upstream main

# Start work: New branch
git checkout -b feat/my-feature

# During work: Regular checks
pnpm lint
pnpm test

# Before commit: Full validation
pnpm lint && pnpm typecheck:all && pnpm test

# End of day: Push work
git push origin feat/my-feature
```

### Code Quality

**Before every commit:**
1. ✅ Run `pnpm lint:fix`
2. ✅ Run `pnpm typecheck:all`
3. ✅ Run `pnpm test`
4. ✅ Review `git diff`

### Asking for Help

**Good question format:**
1. What you're trying to do
2. What you tried
3. What happened (error messages)
4. What you expected

**Example:**
```
I'm trying to add a new API endpoint to the CMS.

I created apps/cms/src/app/api/hello/route.ts with:
[code snippet]

But I get error:
[error message]

I expected it to return JSON response.
```

---

## Congratulations! 🎉

You've completed the tutorial! You now know:

- ✅ How to set up the development environment
- ✅ How the project is structured
- ✅ How to make and test changes
- ✅ How to use CLI tools
- ✅ How to contribute

**Welcome to the RevealUI community!**

Ready to make your first contribution? Check out [good first issues](https://github.com/RevealUIStudio/revealui/labels/good%20first%20issue).

---

**Tutorial Version:** 1.0.0
**Last Updated:** Phase 6 - Documentation & Polish
**Maintained By:** RevealUI Team
