# Contributing Documentation

This guide explains how to contribute documentation to the RevealUI Framework.

## Documentation Structure

See [Documentation Structure](./STRUCTURE.md) for the overall organization.

## Writing Documentation

### Markdown Guidelines

- Use clear, concise language
- Include code examples where helpful
- Keep lines under 100 characters when possible
- Use proper heading hierarchy (## for sections, ### for subsections)

### Code Examples

Always include working code examples:

````markdown
```typescript
import { createRevealUI } from '@revealui/core'

const revealui = await createRevealUI({
  // configuration
})
```
````

### JSDoc Comments

For API documentation, use JSDoc comments in source code:

```typescript
/**
 * Creates a new RevealUI instance.
 *
 * @param config - Configuration options
 * @returns A configured RevealUI instance
 * @example
 * ```typescript
 * const revealui = await createRevealUI({ ... })
 * ```
 */
export async function createRevealUI(config: Config): Promise<RevealUI> {
  // ...
}
```

## Validation

Before submitting documentation:

1. Run validation: `pnpm docs:validate:all`
2. Check for broken links: `pnpm docs:verify:links`
3. Verify code examples: `pnpm docs:verify:code-examples`

## See Also

- [API Documentation Guide](./API-DOCS-GUIDE.md) - How to write API docs
- [Documentation Tools](./DOCUMENTATION-TOOLS.md) - Available tools
