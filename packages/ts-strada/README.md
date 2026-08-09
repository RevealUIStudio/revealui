# `@revealui/ts-strada`

**Strada** TypeScript Compiler API for RevealUI monorepo tooling.

| Concern | Package |
|---------|---------|
| `tsc` typecheck / declaration emit | catalog `typescript@7.0.2` |
| `createSourceFile` / AST walk | **this package** (`typescript@6.0.3`) |
| Next.js build typecheck (`apps/admin`) | pin `typescript@6.0.3` in that app |

Next.js (`verify-typescript-setup`) requires classic
`typescript/lib/typescript.js`. TypeScript 7 (Corsa) does not export that
path, so the Next app keeps an explicit 6.0.3 pin while the monorepo catalog
stays on 7 for CLI `tsc`.

```ts
import ts from '@revealui/ts-strada';
// or
import * as ts from '@revealui/ts-strada';
```

Do not import `typescript` for Compiler API work in this monorepo.

When Corsa ships a supported parse/walk API, migrate callers and remove this
package in the same train.
