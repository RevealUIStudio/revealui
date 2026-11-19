# Manual workflow reference for RevealUI

These are prompts and checklists to read manually or explicitly reference in your editor or assistant. This document does not install slash commands or a background workflow runner. Check the current repository scripts and configuration before using a command.

## Analyze a task

1. Describe the observed behavior, expected behavior, and a small reproduction.
2. Ask your assistant to inspect the relevant source and tests. Verify its claims against the files it cites.
3. Write acceptance criteria and identify the affected test command.
4. Make one focused change, review the diff, and run the affected tests.

Cursor adapter note: the Cursor profile contains `commands/smart-dev.ts` and `commands/generate-code.ts`, but the current consumer `.cursor/` directory does not install them as slash commands. The former writes a template analysis to `docs/analyses/`; the latter reads `validation-report.json` and writes a suggested fix plan. Neither is an automatic implementation workflow.

## Diagnose browser errors

1. Start the affected application with a command that exists in the current `package.json`, such as `pnpm dev:admin` from the RevealUI root.
2. Reproduce the error in a browser and capture the console message, stack trace, network response, and route.
3. Trace the reported source location and confirm the cause before editing.
4. Apply a focused fix, run the affected tests, and reproduce the interaction again.

Cursor adapter note: the Cursor profile includes a Playwright MCP entry in `mcp-config.json`. Availability in a consumer depends on that consumer's MCP configuration and installed tools. Do not assume a dedicated Next.js error analyzer agent is installed.

## Build a React component

1. Find a similar component in the target package and follow its existing structure, exports, styling, and accessibility patterns.
2. Add the new component at the location used by that package.
3. Cover meaningful behavior with an appropriate test and check the rendered interaction.
4. Run the package's typecheck and relevant tests, then inspect the diff.

## Work through a larger change

1. Record the goal, acceptance criteria, and current evidence in the project's planning surface.
2. Break the change into reviewable steps and validate each step before continuing.
3. Keep progress in the project's tracked work unit or ordinary version control history.
4. Finish with a final test pass and a diff review.

There is no `pnpm rev:start`, `rev:status`, `rev:continue`, or `rev:cancel` script in RevealUI's current root `package.json`. Use the project's existing planning and test tools for iterative work.
