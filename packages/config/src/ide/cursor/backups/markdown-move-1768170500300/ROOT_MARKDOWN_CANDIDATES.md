# Root Markdown File Candidates

**Last Updated**: January 11, 2026  
**Status**: Recommendations

---

## Current Allowed Files

- `README.md` - Project overview
- `AGENT.md` - Agent documentation
- `INFRASTRUCTURE.md` / `ARCHITECTURE.md` - Infrastructure/architecture docs
- `SKILLS.md` - Skills documentation

---

## Recommended Additions

### Strong Candidates (GitHub Recognized)

These files are automatically recognized and displayed by GitHub:

1. **SECURITY.md** ✅
   - **Purpose**: Security policy and vulnerability reporting
   - **GitHub**: Automatically displayed in "Security" tab
   - **Location**: Currently in root (violation)
   - **Recommendation**: **Add to allowed list**

2. **CONTRIBUTING.md** ✅
   - **Purpose**: Contribution guidelines and process
   - **GitHub**: Automatically linked when creating PRs/issues
   - **Location**: Currently in root (violation)
   - **Recommendation**: **Add to allowed list**

3. **CODE_OF_CONDUCT.md** ✅
   - **Purpose**: Code of conduct and community guidelines
   - **GitHub**: Automatically displayed in repository
   - **Location**: Currently in root (violation)
   - **Recommendation**: **Add to allowed list**

4. **CHANGELOG.md** ✅
   - **Purpose**: Version history and release notes
   - **GitHub**: Common in root, easy to find
   - **Location**: Currently in root (violation)
   - **Recommendation**: **Add to allowed list**

### Good Candidates (Important but Flexible)

5. **QUICK_START.md** / **GETTING_STARTED.md**
   - **Purpose**: Quick reference and getting started guide
   - **Location**: Currently in root (violation)
   - **Recommendation**: Could go in root or `docs/`
   - **Note**: Very common in root, but `docs/QUICK_START.md` also acceptable

6. **LICENSE.md** (if markdown format)
   - **Purpose**: License information
   - **Note**: Usually `LICENSE` (not .md), but if markdown format
   - **Recommendation**: If markdown, add to allowed list

---

## GitHub Recognition

GitHub automatically recognizes and displays these files:

- ✅ `README.md` - Main project page
- ✅ `SECURITY.md` - Security policy (Security tab)
- ✅ `CONTRIBUTING.md` - Contribution guidelines (PR/Issue creation)
- ✅ `CODE_OF_CONDUCT.md` - Code of conduct (Community tab)
- ✅ `LICENSE` - License (displayed in sidebar)

**Note**: `CHANGELOG.md` is not automatically recognized by GitHub, but is very common in root.

---

## Recommendations

### Option 1: Add GitHub-Recognized Files (Recommended)

Add these 4 files to allowed list:
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md`

**Rationale**: 
- GitHub recognizes and displays these
- Standard practice in open source projects
- Important for contributors and users

### Option 2: Add GitHub-Recognized + Quick Start

Add 5 files:
- All from Option 1
- `QUICK_START.md`

**Rationale**:
- Includes quick reference (very common)
- Still keeps root clean with only essential files

### Option 3: Keep Current (Minimal)

Keep current allowed list only.

**Rationale**:
- Very clean root
- All other files go to `docs/`
- Strict policy

---

## Current Files Analysis

From current violations, these are strong candidates:

- ✅ `SECURITY.md` - Currently in root, GitHub recognizes
- ✅ `CONTRIBUTING.md` - Currently in root, GitHub recognizes
- ✅ `CODE_OF_CONDUCT.md` - Currently in root, GitHub recognizes
- ✅ `CHANGELOG.md` - Currently in root, very common
- ⚠️ `QUICK_START.md` - Currently in root, common but flexible

---

## Recommendation

**Recommended: Option 1** - Add GitHub-recognized files

**Final allowed list**:
- `README.md`
- `AGENT.md`
- `INFRASTRUCTURE.md` / `ARCHITECTURE.md`
- `SKILLS.md`
- `SECURITY.md` ⭐ (add)
- `CONTRIBUTING.md` ⭐ (add)
- `CODE_OF_CONDUCT.md` ⭐ (add)
- `CHANGELOG.md` ⭐ (add)

This gives you:
- ✅ GitHub recognition (automatic display/linking)
- ✅ Standard open source practice
- ✅ Important files easily accessible
- ✅ Still keeps root relatively clean
- ✅ All other files go to `docs/`

---

**Status**: Recommendations for review  
**Decision**: Pending user approval
