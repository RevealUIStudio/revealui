# Root Markdown File Policy

**Last Updated**: January 11, 2026  
**Status**: Active Policy

---

## Policy

**Only predetermined .md files are allowed in the project root. All other .md files must be in `docs/` subfolder.**

---

## Allowed Root Files

The following markdown files (and their variants) are allowed in the project root:

1. **README.md** - Project overview and getting started
2. **AGENT.md** - Agent handoff, instructions, or agent-related documentation (exact match only)
3. **INFRASTRUCTURE.md** / **ARCHITECTURE.md** - Infrastructure or architecture documentation
4. **SKILLS.md** - Skills, capabilities, or competency documentation
5. **SECURITY.md** - Security policy and vulnerability reporting (GitHub recognizes)
6. **CONTRIBUTING.md** - Contribution guidelines (GitHub recognizes)
7. **CODE_OF_CONDUCT.md** - Code of conduct and community guidelines (GitHub recognizes)
8. **CHANGELOG.md** - Version history and release notes

**Allowed Files** (exact matches, case-insensitive):
- `README.md` - Project overview
- `AGENT.md` - Agent documentation (exact match only)
- `INFRASTRUCTURE.md` - Infrastructure documentation
- `ARCHITECTURE.md` - Architecture documentation
- `SKILLS.md` - Skills documentation
- `SECURITY.md` - Security policy (GitHub displays in Security tab)
- `CONTRIBUTING.md` - Contribution guidelines (GitHub links in PR/Issue creation)
- `CODE_OF_CONDUCT.md` - Code of conduct (GitHub displays in Community tab)
- `CHANGELOG.md` - Version history (common in root)

---

## All Other Files

All other markdown files **must** be in `docs/` or an appropriate subfolder:

- `docs/` - Main documentation directory
- `docs/roadmap/` - Future plans
- `docs/archive/` - Historical documentation
- `docs/root/` - Files moved from root (temporary location)

---

## Validation

Run validation to check for violations:

```bash
# Check for violations
pnpm validate:root-markdown

# Automatically move violations to docs/root/
pnpm validate:root-markdown --fix
```

---

## Examples

### ✅ Allowed in Root

```
README.md
AGENT.md
AGENT_HANDOFF.md
INFRASTRUCTURE.md
ARCHITECTURE.md
SKILLS.md
```

### ❌ Must Be in docs/

```
CONTRIBUTING.md          -> docs/CONTRIBUTING.md
CHANGELOG.md             -> docs/CHANGELOG.md
SECURITY.md              -> docs/SECURITY.md
DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md  -> docs/DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md
PROMPT_FOR_NEXT_AGENT.md -> docs/PROMPT_FOR_NEXT_AGENT.md
```

---

## Rationale

1. **Clean Root Directory**: Keeps project root uncluttered
2. **Better Organization**: Documentation is organized in dedicated folders
3. **Easy Navigation**: Clear distinction between root files and documentation
4. **Consistent Structure**: Enforces consistent project structure
5. **Easy to Validate**: Can automatically check and enforce policy

---

## Migration

When migrating existing files:

1. **Run validation**:
   ```bash
   pnpm validate:root-markdown
   ```

2. **Review violations**:
   - Identify which files need to be moved
   - Decide on appropriate `docs/` subfolder

3. **Move files**:
   ```bash
   # Automatic (moves to docs/root/)
   pnpm validate:root-markdown --fix
   
   # Or manually move to appropriate location
   mv CONTRIBUTING.md docs/CONTRIBUTING.md
   ```

4. **Update references**:
   - Update links in documentation
   - Update references in code
   - Update README.md if needed

---

## CI/CD Integration

Add to CI/CD pipeline to enforce policy:

```yaml
- name: Validate Root Markdown Files
  run: pnpm validate:root-markdown
```

---

## Future Considerations

- **Expand allowed files**: If needed, add more patterns to `ALLOWED_PATTERNS`
- **Custom subfolders**: Files could be moved to specific subfolders based on content
- **Automatic categorization**: Could analyze content to suggest appropriate subfolder

---

**Status**: ✅ Policy Active  
**Validation Script**: `scripts/validation/validate-root-markdown.ts`  
**Command**: `pnpm validate:root-markdown`
