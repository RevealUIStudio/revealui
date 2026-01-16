# buildConfig

The `buildConfig` function processes and validates RevealUI configuration using the unified contract system.

## Usage

```typescript
import { buildConfig } from '@revealui/core'
import type { Config } from '@revealui/core'

const config: Config = {
  secret: 'your-secret-key',
  collections: [
    {
      slug: 'posts',
      fields: [
        { type: 'text', name: 'title' },
      ],
    },
  ],
}

const processedConfig = buildConfig(config)
```

## Validation

`buildConfig` uses the `ConfigContract` for comprehensive validation:

- **Structure Validation** - Validates all config properties using Zod schemas
- **Type Safety** - Ensures config matches TypeScript types
- **Error Reporting** - Throws `ConfigValidationError` with detailed error messages

### Error Handling

```typescript
import { buildConfig, ConfigValidationError } from '@revealui/core'

try {
  const config = buildConfig(userConfig)
} catch (error) {
  if (error instanceof ConfigValidationError) {
    // Structured error with detailed information
    console.error(error.message)
    console.error(error.getMessages()) // Array of error messages
    console.error(error.issues) // Full Zod issues array
  }
}
```

## Default Values

`buildConfig` applies sensible defaults:

- `admin.importMap.autoGenerate: true`
- `typescript.autoGenerate: true`
- `typescript.outputFile: 'src/types/revealui.ts'`
- `localization.defaultLocale: 'en'`
- `localization.locales: ['en']`
- `localization.fallback: true`
- `serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || ''`

## Plugin Processing

Plugins are processed after validation:

```typescript
const config = buildConfig({
  secret: 'key',
  collections: [],
  plugins: [
    (cfg) => ({
      ...cfg,
      custom: { pluginData: 'value' },
    }),
  ],
})
```

## Migration from Old Validation

The old `validateConfig` function is now integrated into the contract system. The contract validation handles:

- Secret requirement
- Collections/globals requirement
- All structure validation

No migration needed - `buildConfig` automatically uses contract validation.

## See Also

- [Config Contract Documentation](../../../../schema/src/core/contracts/README.md)
- [Config Type Reference](../../types/index.ts)
