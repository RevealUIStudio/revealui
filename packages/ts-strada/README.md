# `@revealui/ts-strada`

**Strada** TypeScript Compiler API for RevealUI monorepo tooling.

| Concern | Package |
|---------|---------|
| `tsc` typecheck / declaration emit | catalog `typescript` (currently **6.0.3**) |
| `createSourceFile` / AST walk | **this package** (`typescript@6.0.3`) |
| Next.js build typecheck (`apps/admin`) | same classic `typescript` (needs `lib/typescript.js`) |

## Why this package exists

TypeScript **7 (Corsa)** drops the classic Compiler API path
(`typescript/lib/typescript.js`). Next.js still requires that path for
`next build` typecheck. Dual-installing 6 + 7 also splits peer-dep type
graphs (for example `lexical@…_typescript@6` vs `…@7`), which fails
assignability across packages.

Until Next (and peer-dep consumers) support Corsa, the monorepo catalog
stays on Strada 6. This package is the **single import** for Compiler API
work so a future catalog bump to 7 only needs to keep the classic bridge
here (or migrate callers when Corsa ships a supported parse/walk API).

```ts
import ts from '@revealui/ts-strada';
// or
import * as ts from '@revealui/ts-strada';
```

Do not import `typescript` for Compiler API work in this monorepo.
