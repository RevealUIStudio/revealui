# Vercel Skills Integration Implementation

This document describes the implementation of Vercel Skills integration in RevealUI.

## Architecture

### Bridge Pattern

RevealUI doesn't replace its skills system - instead, it creates a bridge layer that:
1. Imports skills from the Vercel ecosystem
2. Converts them to RevealUI's format
3. Enhances them with RevealUI features (embeddings, etc.)
4. Registers them in the unified SkillRegistry

### Directory Structure

```
packages/ai/src/skills/
├── catalog/                      # Vercel catalog integration
│   ├── catalog-types.ts         # Type definitions for catalog
│   ├── vercel-catalog.ts        # Fetch and cache catalog
│   ├── catalog-search.ts        # Search catalog
│   └── index.ts
├── compat/                       # Compatibility layer
│   ├── vercel-compat.ts         # Format conversion
│   ├── skill-enhancer.ts        # Add embeddings, etc.
│   ├── tool-mapper.ts           # Map tool names
│   └── index.ts
├── loader/
│   ├── github-loader.ts         # Existing GitHub loader
│   ├── local-loader.ts          # Existing local loader
│   ├── vercel-loader.ts         # NEW: Vercel loader
│   ├── vercel-types.ts          # NEW: Vercel types
│   └── index.ts
├── types.ts                      # MODIFIED: Added source tracking
└── index.ts                      # MODIFIED: Export new modules
```

## Key Components

### 1. Vercel Loader (`loader/vercel-loader.ts`)

Main integration point. Handles:
- Installing via `npx skills add` CLI
- Fallback to direct git clone
- Parsing SKILL.md
- Converting to RevealUI format
- Generating embeddings

**Key Function:**
```typescript
async function loadFromVercelSkills(
  source: string,
  options: VercelLoadOptions
): Promise<Skill>
```

### 2. Catalog Integration (`catalog/`)

Fetches and caches the Vercel Skills catalog:
- `vercel-catalog.ts`: Main catalog fetching with 24hr cache
- `catalog-search.ts`: Search by keyword, tag, compatibility
- `catalog-types.ts`: Type definitions

**Catalog Cache:** `~/.revealui/cache/vercel-catalog.json`

### 3. Compatibility Layer (`compat/`)

Ensures Vercel skills work with RevealUI:

**vercel-compat.ts**: Format conversion
- `checkVercelCompatibility()`: Validate skill compatibility
- `normalizeVercelSkill()`: Convert to RevealUI format
- `toVercelFormat()`: Export RevealUI skills to Vercel format

**skill-enhancer.ts**: Add RevealUI features
- `generateEmbeddingsForVercelSkill()`: Add semantic search capability
- `batchGenerateEmbeddings()`: Process multiple skills
- `enhanceSkillMetadata()`: Add tags, compatibility

**tool-mapper.ts**: Map tool names between formats
- `mapVercelToolsToRevealUI()`: Convert lowercase to PascalCase
- `mapRevealUIToolsToVercel()`: Convert PascalCase to lowercase
- Handles tool filters: `bash(git:*)` → `Bash(git:*)`

### 4. Source Tracking (`types.ts`)

Extended `Skill` type with:
```typescript
{
  source?: 'github' | 'local' | 'vercel'
  sourceIdentifier?: string  // Original source (e.g., GitHub URL)
}
```

This enables:
- Knowing where each skill came from
- Skill-specific update logic
- Proper namespacing

### 5. CLI Integration (`scripts/cli/skills.ts`)

Extended existing CLI with:
- `--vercel` flag on `add` command
- `search --vercel` to search catalog
- `trending --vercel` to show popular skills
- `update <name>` to update Vercel skills

## Installation Flow

```
User runs: pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

1. CLI parses command and flags
   ↓
2. Calls loadFromVercelSkills(source, options)
   ↓
3. Tries: npx skills add <source>
   Fallback: Direct git clone
   ↓
4. Parses SKILL.md → SkillMetadata + instructions
   ↓
5. Creates Skill object with source='vercel'
   ↓
6. Generates embeddings for semantic search
   ↓
7. Normalizes tool names (bash → Bash)
   ↓
8. Registers in SkillRegistry
   ↓
9. Returns Skill object
```

## Catalog Flow

```
User runs: pnpm skills search "react hooks" --vercel

1. CLI calls searchVercelCatalog(query)
   ↓
2. fetchVercelCatalog() loads or fetches catalog
   ↓
3. Check cache (~/.revealui/cache/vercel-catalog.json)
   - Valid (< 24hr)? Return cached
   - Expired? Fetch fresh
   ↓
4. Search catalog by:
   - Name match (highest weight)
   - Description match (medium)
   - Tag match (medium)
   - Owner/repo match (low)
   ↓
5. Return sorted results with scores
```

## Update Flow

```
User runs: pnpm skills update react-best-practices

1. Load skill from registry
   ↓
2. Verify source === 'vercel'
   ↓
3. checkVercelSkillUpdates(name, registry)
   - Compare current version
   - Check remote for changes
   ↓
4. If update available:
   updateVercelSkill(name, registry)
   - Reinstall with force flag
   - Preserve embeddings setting
   ↓
5. Return updated skill
```

## Testing Strategy

### Unit Tests (`__tests__/vercel-integration.test.ts`)

Tests for:
- Source parsing (owner/repo, paths, refs)
- Compatibility checking
- Tool name mapping
- Format normalization

### Integration Testing (Manual)

1. Install Vercel skill:
   ```bash
   pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
   ```

2. Verify installation:
   ```bash
   pnpm skills list
   pnpm skills info react-best-practices
   ```

3. Search catalog:
   ```bash
   pnpm skills search "react" --vercel
   ```

4. Update skill:
   ```bash
   pnpm skills update react-best-practices
   ```

## Error Handling

### npx skills fails
→ Automatic fallback to git clone

### Git clone fails
→ Error with clear message

### SKILL.md missing
→ Clean up installation, throw error

### Incompatible skill
→ Warning but allow installation

### Update fails
→ Suggest manual reinstall with --force

## Performance Considerations

### Catalog Caching
- 24hr cache reduces network requests
- Stored in `~/.revealui/cache/`
- Force refresh with `forceRefresh: true`

### Embedding Generation
- Only for Vercel skills (opt-in feature)
- Batch processing with concurrency limit
- Reuse existing embeddings on update

### Sparse Checkout
- Use git sparse-checkout for monorepo paths
- Reduces clone size and time
- Falls back to full clone if needed

## Future Enhancements

### Near-term
- [ ] Real-time catalog API (when available from Vercel)
- [ ] Automatic update checks (background)
- [ ] Skill dependency resolution

### Medium-term
- [ ] Publish RevealUI skills to Vercel catalog
- [ ] Skill ratings and reviews
- [ ] Install from npm packages

### Long-term
- [ ] Skill marketplace UI
- [ ] Community contributions
- [ ] Skill analytics (usage, popularity)

## Dependencies

Added to `packages/ai/package.json`:
- `semver`: ^7.6.0 (version comparison)

Uses Node.js built-in:
- `node:fetch` (Node 18+)
- `node:child_process` (exec for git/npx)

## API Surface

### Loader
```typescript
loadFromVercelSkills(source: string, options: VercelLoadOptions): Promise<Skill>
checkVercelSkillUpdates(skillName: string, registry: SkillRegistry): Promise<UpdateInfo>
updateVercelSkill(skillName: string, registry: SkillRegistry): Promise<Skill>
isVercelCliAvailable(): Promise<boolean>
parseVercelSource(source: string): VercelSource
```

### Catalog
```typescript
fetchVercelCatalog(config?: CatalogConfig): Promise<VercelCatalog>
searchVercelCatalog(query: string, options?: SearchOptions): Promise<VercelSkillSearchResult[]>
getTrendingSkills(limit?: number, config?: CatalogConfig): Promise<VercelCatalogSkill[]>
getSkillsByTag(tag: string, config?: CatalogConfig): Promise<VercelCatalogSkill[]>
getSkillsByCompatibility(compatibility: string, config?: CatalogConfig): Promise<VercelCatalogSkill[]>
getSkillById(id: string, config?: CatalogConfig): Promise<VercelCatalogSkill | undefined>
clearCatalogCache(cacheDir?: string): void
```

### Compatibility
```typescript
checkVercelCompatibility(skill: Skill): true | string
normalizeVercelSkill(skill: Skill): Skill
toVercelFormat(metadata: SkillMetadata): Record<string, unknown>
generateEmbeddingsForVercelSkill(skill: Skill): Promise<Skill>
batchGenerateEmbeddings(skills: Skill[], concurrency?: number): Promise<Skill[]>
enhanceSkillMetadata(skill: Skill, enhancements: {...}): Skill
mapVercelToolsToRevealUI(vercelTools: string[]): string[]
mapRevealUIToolsToVercel(revealuiTools: string[]): string[]
isToolSupported(tool: string): boolean
```

## Backwards Compatibility

✅ **No breaking changes**
- Existing skills (GitHub, local) continue to work
- All existing CLI commands unchanged
- New features are opt-in via `--vercel` flag

## Documentation

- [VERCEL_SKILLS_INTEGRATION.md](../../../docs/VERCEL_SKILLS_INTEGRATION.md) - User guide
- [VERCEL_SKILLS.md](./VERCEL_SKILLS.md) - This file (implementation)
- [AUTOMATION.md](../../../docs/AUTOMATION.md) - Overall skills system (to be updated)
