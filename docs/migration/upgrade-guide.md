# RevealUI Framework Upgrade Guide

This guide covers upgrading between major versions of RevealUI Framework.

## Version History

### v2.0.0 (Current)
- Unified configuration system
- New plugin API
- Enhanced CLI
- Type generation
- Performance improvements

### v1.0.0 (Previous)
- Basic framework
- RevealUI integration
- PayloadCMS integration

## Upgrade from v1.0.0 to v2.0.0

### Breaking Changes

1. **Configuration System**
   - New `reveal.config.ts` format
   - Old `+config.ts` still works but deprecated
   - See [Config Migration Guide](./config-system.md)

2. **Plugin System**
   - New plugin API
   - Old Vite plugins still work
   - See [Plugin Migration Guide](./plugin-system.md)

3. **CLI Changes**
   - New commands: `init`, `add`, `doctor`
   - Enhanced `generate` command
   - See [CLI Documentation](./api-reference/cli.md)

### Non-Breaking Changes

- Type generation (new feature)
- Performance monitoring (new feature)
- Compliance features (new feature)

## Step-by-Step Upgrade

### 1. Update Dependencies

```bash
pnpm update reveal@latest
pnpm update @revealui/plugin-*@latest
```

### 2. Create New Config

Create `reveal.config.ts` (see [Config Migration](./config-system.md))

### 3. Update Plugins

Update plugin usage (see [Plugin Migration](./plugin-system.md))

### 4. Test

```bash
pnpm build
pnpm dev
pnpm test
```

### 5. Update Code

- Replace deprecated APIs
- Update type imports
- Fix any breaking changes

## Deprecated APIs

### pageContext.userAgent
**Deprecated in:** v2.0.0  
**Removed in:** v3.0.0  
**Replacement:** `pageContext.headers['user-agent']`

```typescript
// Old
const userAgent = pageContext.userAgent

// New
const userAgent = pageContext.headers['user-agent']
```

## Migration Checklist

- [ ] Update dependencies
- [ ] Create `reveal.config.ts`
- [ ] Migrate plugins
- [ ] Update deprecated APIs
- [ ] Run tests
- [ ] Update documentation
- [ ] Deploy to staging
- [ ] Verify functionality
- [ ] Deploy to production

## Rollback Plan

If you need to rollback:

1. Revert dependency versions in `package.json`
2. Remove `reveal.config.ts` (if created)
3. Restore old `+config.ts` files
4. Revert plugin changes
5. Run `pnpm install`
6. Test and deploy

## Support

For upgrade issues:
- Check [Known Limitations](./KNOWN-LIMITATIONS.md)
- Review [Breaking Changes](./BREAKING-CHANGES.md)
- Open a GitHub issue

