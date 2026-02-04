# Visual Snapshot Tests - Changelog

## 2026-02-03: Updated for Real CMS Routes

### What Changed

The visual snapshot tests have been completely rewritten to target **actual routes** that exist in the RevealUI CMS application, replacing fictional routes that don't exist.

### Old vs New Routes

| Old Route (Fictional) | New Route (Real) | Purpose |
|----------------------|------------------|---------|
| `/login` | `/admin/login` | Admin authentication |
| `/signup` | `/admin` | Admin panel access |
| N/A | `/admin/collections` | Collections management |
| N/A | `/admin/globals` | Globals management |
| `/` | `/` | Frontend home page |
| N/A | `/posts` | Posts listing |

### New Test Structure

The tests are now organized into logical groups:

#### 1. **Admin Panel** (4 tests)
- Admin login page
- Admin dashboard
- Admin collections page
- Admin globals page

#### 2. **Frontend Pages** (4 tests)
- Home page
- Posts listing page
- Navigation header component
- Footer component

#### 3. **Responsive Snapshots** (5 tests)
- Home page: mobile, tablet, desktop viewports
- Admin login: mobile viewport
- Admin dashboard: tablet viewport

#### 4. **Theme Snapshots** (3 tests)
- Home page: dark mode
- Home page: light mode
- Admin login: dark mode

#### 5. **Accessibility Snapshots** (1 test)
- Home page: high contrast mode

#### 6. **Error States** (1 test)
- 404 page

#### 7. **Cross-Browser Consistency** (2 tests)
- Home page across browsers
- Admin login across browsers

#### 8. **Animation Control** (1 test)
- Home page with animations disabled

#### 9. **Masked Snapshots** (1 test)
- Home page with dynamic content masked

**Total: 22 tests** (down from 73 fictional tests)

### Why This Matters

**Before:**
- ❌ 73 tests targeting non-existent routes
- ❌ Tests expected login forms that don't exist in a CMS
- ❌ High failure rate due to wrong assumptions
- ❌ Tests not useful for actual visual regression detection

**After:**
- ✅ 22 tests targeting real CMS routes
- ✅ Tests match actual application architecture
- ✅ Focused on critical user journeys (admin panel + frontend)
- ✅ Practical visual regression detection for CMS pages

### Benefits

1. **Accurate Testing**: Tests now validate actual pages users will see
2. **Fewer False Positives**: No more failures from non-existent routes
3. **Better Coverage**: Admin panel AND frontend pages covered
4. **Maintainable**: Test structure matches application structure
5. **Actionable**: Visual diffs now represent real UI changes

### How to Use

```bash
# Generate baseline snapshots
pnpm test:e2e:visual:update:chromium

# Run visual regression tests
pnpm test:e2e:visual:chromium

# View detailed report
pnpm test:e2e:report
```

### File Changes

- ✅ Updated: `e2e/visual-snapshots.e2e.ts` - Complete rewrite
- ✅ Updated: `e2e/README-VISUAL-SNAPSHOTS.md` - Updated examples
- ✅ Created: `e2e/VISUAL-SNAPSHOTS-CHANGELOG.md` - This file
- 🔄 In Progress: Generating new baseline snapshots

### Migration Notes

Old snapshots in `e2e/__snapshots__/visual-snapshots.e2e.ts/` have been removed and will be regenerated with the new test structure.

### Next Steps

1. ✅ Tests updated to use real routes
2. 🔄 Generating new baseline snapshots (in progress)
3. ⏳ Review snapshots and commit to Git
4. ⏳ Set up CI/CD to run these tests on pull requests

### Technical Details

**Fixed Issues:**
- Header global error handling (graceful degradation)
- Logger import issues in server components
- Route configuration aligned with CMS architecture

**Test Configuration:**
- Chromium-only tests for WSL compatibility
- Full page snapshots for comprehensive coverage
- Network idle wait for complete page load
- Dark/light theme testing via color scheme emulation
- Responsive viewport testing (mobile, tablet, desktop)
