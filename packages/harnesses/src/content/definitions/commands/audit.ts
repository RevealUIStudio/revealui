import type { Command } from '../../schemas/command.js';

export const auditCommand: Command = {
  id: 'audit',
  tier: 'oss',
  name: 'Audit',
  description:
    'Audit the codebase for avoidable `any` types and production console statements. Use when asked to check code quality, before a release, or after a large refactor.',
  disableModelInvocation: false,
  content: `Run code quality audits on the RevealUI monorepo.

Execute these audit commands in sequence:

1. \`pnpm audit:any\`  -  Find avoidable \`any\` types across the codebase
2. \`pnpm audit:console\`  -  Find production \`console.*\` statements that should use the logger

Report findings as a summary table with package name and count. If issues are found, suggest fixes.

Target: 0 avoidable \`any\` types, 0 production console statements.`,
};
