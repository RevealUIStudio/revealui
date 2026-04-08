import type { Command } from '../../schemas/command.js';

export const newPackageCommand: Command = {
  id: 'new-package',
  tier: 'oss',
  name: 'New Package',
  description:
    'Scaffold a new @revealui/* package with package.json, tsconfig.json, tsup.config.ts, and src/index.ts. Only invoke when explicitly asked to create a new package.',
  disableModelInvocation: true,
  argumentHint: '<package-name>',
  content: `Scaffold a new package in the RevealUI monorepo.

Arguments: $ARGUMENTS (package name, e.g., "analytics")

Create the following structure at \`packages/<name>/\`:

1. \`package.json\` with:
   - name: \`@revealui/<name>\`
   - version: \`0.1.0\`
   - type: \`module\`
   - exports, main, types pointing to \`dist/\`
   - scripts: build, dev, lint, test, typecheck
   - publishConfig.access: \`public\` (or \`"private": true\` for Pro packages)
   - engines.node: \`>=24.13.0\`

2. \`tsconfig.json\` extending \`@revealui/dev/tsconfig\`

3. \`tsup.config.ts\` with entry \`src/index.ts\`, dts, format esm

4. \`src/index.ts\` with a placeholder export

5. \`README.md\` with package name and description

After scaffolding, remind the user to:
- Run \`pnpm install\` to link the new package
- Add \`workspace:*\` references from consuming packages
- Create a changeset with \`pnpm changeset\``,
};
