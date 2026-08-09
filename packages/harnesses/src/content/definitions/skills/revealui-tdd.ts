import type { Skill } from '../../schemas/skill.js';

export const revealuiTddSkill: Skill = {
  id: 'revealui-tdd',
  tier: 'pro',
  name: 'RevealUI TDD',
  description:
    'Test-driven development for RevealUI: agree seams first, then red-green vertical slices with Vitest. Use when implementing features, fixing bugs, or writing tests.',
  disableModelInvocation: false,
  skipFrontmatter: false,
  filePatterns: [],
  bashPatterns: [],
  references: {},
  content: `# RevealUI TDD Workflow

Follow this cycle for every code change. No exceptions.

## What a good test is

Tests verify **behavior through public interfaces**, not implementation details. Code can change entirely; tests should survive. A good test reads like a specification ("user can checkout with a valid cart") and fails only when behavior changes.

Expected values must come from an **independent source of truth** (spec, known-good literal, worked example). Do not recompute the expected value the same way the production code does.

## Seams (agree before writing tests)

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against private internals.

**Before writing any test**, list the seams under test and confirm them (with the user when available):

- Prefer existing public package exports (\`@revealui/*\` entry points) over new seams.
- Prefer the highest seam that still catches the bug or feature (integration over pure unit when the bug needs the call chain).
- Prefer fewer seams. Do not add a seam "just for testability" if the real interface can express the behavior.

Ask: "What is the public interface, and which seams should we test?"

For module shape questions (depth, interface size, locality), keep tests at the agreed seam and escalate design redesigns rather than testing past the interface.

## The red-green cycle (vertical slices)

Work in **vertical slices**, not horizontal bulk:

1. **Write one failing test** at a confirmed seam  -  one behavior, one assertion focus
2. **Run it**  -  confirm it fails for the **right** reason (not import/setup noise)
3. **Write minimal implementation**  -  just enough to pass; no speculative features
4. **Run it**  -  confirm it passes
5. **Tiny cleanup only**  -  rename for clarity, extract only what this slice needs. Broad redesign belongs in review, not in the red-green loop
6. **Commit**  -  one commit per slice when the change is ready to land

**Tracer bullet:** each slice is a thin complete path that teaches the next slice. Do not write all tests first, then all implementation (horizontal slicing).

## Commands

\`\`\`bash
# Run tests for a specific package
pnpm --filter @revealui/<package> test

# Run a specific test file
pnpm --filter @revealui/<package> test -- <file>

# Run with coverage
pnpm --filter @revealui/<package> test -- --coverage
\`\`\`

## Test File Conventions

- Unit/integration: \`*.test.ts\` in \`src/__tests__/\` or adjacent to source
- E2E: \`*.e2e.ts\` in \`packages/test/\`
- Use \`@revealui/test\` for shared fixtures, mocks, and utilities

## What to Test

- Public API surface of each module
- Error paths and edge cases at the agreed seams
- Integration points between packages when the seam is inter-package

## What NOT to Test

- Private implementation details
- Third-party library internals
- Type-only code (interfaces, type aliases)

## Repo-Specific Patterns

For concurrency tuning, flaky test triage, and Pro/OSS test boundaries, see the \`$revealui-testing\` skill.

## Anti-Patterns

- **Implementation before red**  -  writing code before a failing test
- **Green on arrival**  -  tests that pass immediately (never proved red)
- **Implementation-coupled**  -  mocking internal collaborators, testing private methods, or asserting via side channels (raw DB) instead of the public interface. Tell: test breaks on refactor with no behavior change
- **Tautological**  -  expected value recomputed the same way as the code (\`expect(add(a,b)).toBe(a+b)\`). Cannot disagree with the code
- **Horizontal slicing**  -  all tests first, then all implementation; tests lock imagined shape instead of learned behavior
- **Testing past the seam**  -  reaching into internals because the module is the wrong shape; fix the seam or file a design follow-up
- **Large multi-feature commits**  -  many slices in one commit without a green checkpoint
`,
};
