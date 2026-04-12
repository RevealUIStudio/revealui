import type { Skill } from '../../schemas/skill.js';

export const revealuiDebuggingSkill: Skill = {
  id: 'revealui-debugging',
  tier: 'pro',
  name: 'RevealUI Debugging',
  description:
    'Systematic debugging workflow for RevealUI. Use when encountering any bug, test failure,\nunexpected behavior, error, or broken functionality. Prevents shotgun debugging.',
  disableModelInvocation: false,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
  content: `# RevealUI Debugging Workflow

When something breaks, follow this process. Do not skip steps.

## The Process

### 1. Reproduce

- Get the exact error message, stack trace, or unexpected output
- Find the minimal reproduction case
- Confirm it reproduces consistently (not flaky)
- If it only fails under \`turbo run test\`, see \`$revealui-testing\` for concurrency triage

### 2. Hypothesize

- Form ONE specific hypothesis about the root cause
- Write it down before changing any code
- Base it on evidence (error message, stack trace, git blame), not intuition

### 3. Validate

- Design a test or check that confirms/refutes your hypothesis
- Run it
- If refuted, form a new hypothesis  -  do not stack unrelated fixes

### 4. Fix Narrowly

- Change the minimum code to fix the root cause
- Do not refactor surrounding code
- Do not fix adjacent issues you noticed along the way (file them separately)

### 5. Verify

- Run the original failing test/scenario
- Run \`pnpm --filter <package> test\` to check for regressions
- Run \`npx biome check --write <file>\` on changed files

### 6. Commit

- One commit for the fix
- Format: \`fix(scope): description of what was broken\`

## Anti-Patterns

- Changing multiple things at once ("shotgun debugging")
- Fixing symptoms instead of root causes
- Adding try/catch blocks to silence errors
- Increasing timeouts to hide race conditions
- Reverting to "known good" without understanding what broke
- Asking "does this fix it?" without a hypothesis

## Common RevealUI Debugging Paths

| Symptom | First Check |
|---------|------------|
| Import error | Package built? \`pnpm --filter <pkg> build\` |
| Type error across packages | \`pnpm typecheck:all\`  -  check \`workspace:*\` versions |
| Test passes alone, fails in gate | Concurrency pressure  -  see \`$revealui-testing\` |
| Supabase error in unexpected path | Import boundary violation  -  see \`$revealui-db\` |
| Biome error after edit | Run \`npx biome check --write <file>\` |`,
};
