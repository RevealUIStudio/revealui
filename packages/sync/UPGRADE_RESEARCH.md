# ElectricSQL Upgrade Research

This document tracks research into latest package versions, breaking changes, and compatibility for upgrading to ElectricSQL 1.1+.

## Current Versions

### Installed Versions

- **@electric-sql/client**: `^1.4.0`
- **@electric-sql/react**: `^1.0.26`

### Latest Available Versions (as of research date)

- **@electric-sql/client**: `1.4.0` ✅ (Latest, includes 1.1+ features)
- **@electric-sql/react**: `1.0.26` ✅ (Latest stable)
- **@electric-sql/cli**: `0.11.4-canary` (Canary version available)

### Target Versions

- **@electric-sql/client**: ✅ Already at 1.4.0 (includes 1.1+ features)
- **@electric-sql/react**: ✅ Already at 1.0.26 (latest stable, verify compatibility)
- **@electric-sql/cli**: Check if used, consider stable version if needed

## Version Research

### @electric-sql/client

**Current**: 1.4.0  
**Latest**: 1.4.0  
**Status**: ✅ Already at latest version, includes 1.1+ features  
**Action**: Verify compatibility with current code

**Notes**:
- Version 1.4.0 is the latest stable version
- Includes versions 1.1.0 through 1.4.0, so has 1.1+ features
- Version history shows: 1.0.x → 1.1.0 → 1.1.1-1.1.5 → 1.2.0-1.2.2 → 1.3.0-1.3.1 → 1.4.0
- No upgrade needed, but verify:
  - Compatibility with current code
  - All 1.1+ features available
  - No breaking changes from 1.0.x

### @electric-sql/react

**Current**: 1.0.26  
**Latest**: 1.0.26  
**Status**: ✅ Already at latest stable version  
**Action**: Verify compatibility with @electric-sql/client 1.4.0

**Notes**:
- Version 1.0.26 is the latest stable version
- No 1.1+ version available yet (still at 1.0.x line)
- Version history shows: 1.0.8 → ... → 1.0.26 (latest)
- Need to verify:
  - Compatibility with @electric-sql/client 1.4.0
  - useShape hook API compatibility
  - No breaking changes expected

### @electric-sql/cli

**Status**: Not currently in dependencies  
**Action**: Check if used in scripts, add if needed

**Notes**:
- Check `package.json` scripts for `electric-sql` or `@electric-sql/cli` usage
- Check root `package.json` for CLI usage
- May be used for schema generation

## Breaking Changes Research

### ElectricSQL 1.0 → 1.1

**Key Changes** (from blog articles):
- New storage engine with 100x faster writes
- Performance improvements
- Potential API changes (need to verify)

**Action Items**:
- [ ] Review ElectricSQL 1.1 release notes
- [ ] Check for breaking API changes
- [ ] Verify useShape hook compatibility
- [ ] Check shape URL format changes
- [ ] Verify shape params structure changes

### ElectricSQL 1.0 → 1.1 (Client Packages)

**Potential Changes**:
- Type definition updates
- Hook API changes
- Error handling changes
- Performance improvements

**Action Items**:
- [ ] Review @electric-sql/client changelog
- [ ] Review @electric-sql/react changelog
- [ ] Check npm package pages for breaking changes
- [ ] Test compatibility with current code

## Durable Streams Research

### Package Identification

**Question**: Is Durable Streams:
- Separate package?
- Included in @electric-sql/client?
- Part of service configuration?

**Research Needed**:
- [ ] Check for `@electric-sql/durable-streams` package
- [ ] Review @electric-sql/client for Durable Streams support
- [ ] Check ElectricSQL service configuration options
- [ ] Review Durable Streams 0.1.0 release notes

### Integration Approach

**If Separate Package**:
- Install `@electric-sql/durable-streams` (or similar)
- Update client configuration
- Modify shape operations

**If Included in Client**:
- Update @electric-sql/client to version with Durable Streams
- Update configuration if needed
- Test resumability features

**If Service Configuration**:
- Update ElectricSQL service configuration
- No client code changes needed
- Test service features

## Version Compatibility Matrix

### Compatibility Targets

| Package | Current | Latest | Target | Status |
|---------|---------|--------|--------|--------|
| @electric-sql/client | 1.4.0 | 1.4.0 | Latest 1.1+ | ✅ Already at latest |
| @electric-sql/react | 1.0.26 | 1.0.26 | Latest stable | ✅ Already at latest |
| @electric-sql/cli | N/A | 0.11.4-canary | Latest stable | ⚠️ Check if needed |
| ElectricSQL Service | latest | latest | 1.1+ | ⚠️ Update Docker image |

### React Compatibility

- **React 18**: ✅ Supported (peer dependency)
- **React 19**: ✅ Supported (peer dependency)
- **Current**: React 19.2.3

### Node.js Compatibility

- **Node 18+**: ✅ Required
- **Node 20+**: ✅ Recommended
- **Current**: Check project Node version

## Research Actions

### Immediate Actions

1. **Check Latest Versions**
   ```bash
   npm view @electric-sql/client versions --json
   npm view @electric-sql/react versions --json
   npm view @electric-sql/cli versions --json
   ```

2. **Review Changelogs**
   - Check npm package pages
   - Review GitHub releases
   - Check ElectricSQL blog for version announcements

3. **Verify Compatibility**
   - Test current code with latest versions
   - Run compatibility tests
   - Check for TypeScript errors

### Documentation Review

- [ ] ElectricSQL 1.1 release notes
- [ ] @electric-sql/client changelog
- [ ] @electric-sql/react changelog
- [ ] Durable Streams documentation
- [ ] Breaking changes documentation

## Next Steps

1. **Run Version Check Commands**
   - Check latest versions on npm
   - Compare with current versions
   - Identify upgrade path

2. **Review Documentation**
   - Read release notes for target versions
   - Check for breaking changes
   - Document migration requirements

3. **Create Upgrade Plan**
   - Document version upgrade steps
   - List breaking changes
   - Create migration checklist

4. **Test Compatibility**
   - Run compatibility tests
   - Test with latest versions
   - Verify API compatibility

## Notes

- Current @electric-sql/client version (1.4.0) may already be 1.1+
- @electric-sql/react version (1.0.26) may need upgrade
- Durable Streams integration approach needs clarification
- Service Docker image needs update to 1.1+

## References

- ElectricSQL Blog: https://electric-sql.com/blog
- npm @electric-sql/client: https://www.npmjs.com/package/@electric-sql/client
- npm @electric-sql/react: https://www.npmjs.com/package/@electric-sql/react
- ElectricSQL Docs: https://electric-sql.com/docs
