# `@revealui/ts-strada`

**Strada** TypeScript Compiler API for RevealUI monorepo tooling.

| Concern | Package |
|---------|---------|
| `tsc` typecheck / declaration emit | catalog `typescript@7.0.2` |
| `createSourceFile` / AST walk | **this package** (`typescript@6.0.3`) |

```ts
import ts from '@revealui/ts-strada';
// or
import * as ts from '@revealui/ts-strada';
```

Do not import `typescript` for Compiler API work in this monorepo.

When Corsa ships a supported parse/walk API, migrate callers and remove this
package in the same train.
