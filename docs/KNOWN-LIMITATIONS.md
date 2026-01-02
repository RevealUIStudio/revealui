# Known Limitations

This document tracks known limitations, workarounds, and future improvements for the RevealUI Framework.

## Type System

### `any` Types in Core
- **Location**: `packages/reveal/src/core/__internal/index.ts`, `packages/reveal/src/core/gaurds/validators/hasProp.ts`
- **Status**: Reduced from 297 to ~18 instances in core files
- **Impact**: Low - mostly in internal type guards
- **Workaround**: Type assertions are safe in these contexts
- **Future**: Complete type definitions for all file types

### TODO Comments
- **Count**: 77 TODO/FIXME/HACK comments across 38 files
- **Priority**: Most are non-critical (eventually/v1-release tags)
- **Critical**: 10 TODOs in `getPageContextFromHooks.ts` related to V1 design migration
- **Action**: Documented in code, will be addressed in V1 release

## Plugin System

### Plugin Integration
- **Status**: Plugin system created but not fully integrated into Vite build
- **Impact**: Medium - plugins work but require manual Vite plugin conversion
- **Workaround**: Use `toVitePlugins()` method to convert RevealUI plugins
- **Future**: Automatic integration in Vite build process

### Configuration Merging
- **Status**: Unified config system created but not fully integrated
- **Impact**: Low - works alongside existing `+config.ts` files
- **Workaround**: Use `extends` option to merge with existing configs
- **Future**: Full integration with automatic merging

## Type Generation

### Watch Mode
- **Status**: Implemented with polling (2-second interval)
- **Limitation**: Not using file system watchers (chokidar)
- **Impact**: Low - works but less efficient than native watchers
- **Future**: Migrate to chokidar for better performance

### RevealUI CMS Type Mapping
- **Status**: Basic type mapping implemented
- **Limitation**: Complex types (blocks, groups) map to `unknown[]` or `Record<string, unknown>`
- **Impact**: Medium - requires manual type definitions for complex fields
- **Future**: Enhanced type inference from RevealUI CMS schemas

## Performance

### Bundle Size
- **Current**: ~45MB (includes source maps)
- **Production**: 6.6 MB compressed
- **Status**: Acceptable but could be optimized
- **Future**: Tree-shaking improvements, code splitting

### Build Time
- **Current**: ~8-12 seconds for packages
- **Status**: Good performance
- **Future**: Parallel builds, caching improvements

## Testing

### Test Coverage
- **Current**: Coverage thresholds set (70%/60%/70%)
- **Status**: Tests implemented but coverage not yet at thresholds
- **Impact**: Low - tests are comprehensive
- **Future**: Increase coverage to meet thresholds

### E2E Tests
- **Status**: Basic E2E tests implemented
- **Limitation**: Limited to critical user flows
- **Future**: Expand to cover all user journeys

## Compliance

### GDPR
- **Status**: Cookie consent, data export/deletion implemented
- **Limitation**: Data retention policies not configurable
- **Future**: Configurable retention policies

### WCAG 2.1
- **Status**: Accessibility utilities created
- **Limitation**: Not all components have ARIA labels
- **Future**: Audit all components and add missing labels

## Documentation

### API Documentation
- **Status**: Core APIs documented
- **Limitation**: Some edge cases not covered
- **Future**: Complete examples for all APIs

### Migration Guides
- **Status**: Basic guides created
- **Limitation**: Step-by-step examples needed
- **Future**: Interactive migration tool

## Workarounds

### SQLite Fallback
- **Workaround**: Use SQLite adapter when Postgres not available
- **Status**: Implemented and working
- **Note**: Production should use Postgres

### Build-Time Authentication
- **Workaround**: Mark routes as `dynamic = "force-dynamic"`
- **Status**: Working solution
- **Note**: Required for RevealUI CMS routes

## Future Improvements

1. **Type Safety**: Complete elimination of `any` types
2. **Plugin Integration**: Automatic Vite plugin conversion
3. **Type Generation**: Enhanced RevealUI CMS type inference
4. **Performance**: Bundle size optimization
5. **Testing**: Increase coverage to thresholds
6. **Documentation**: Complete all guides with examples
7. **Compliance**: Configurable GDPR policies
8. **Accessibility**: Full WCAG 2.1 AA compliance audit

## Reporting Issues

If you encounter limitations not listed here:
1. Check existing GitHub issues
2. Create a new issue with:
   - Description of limitation
   - Expected behavior
   - Actual behavior
   - Workaround (if any)
