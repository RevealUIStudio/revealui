# Cross-Tool Validation Prompts

Test these prompts in any AI coding tool to verify it follows RevealUI conventions. Each prompt has an expected behavior  -  the tool should match it without being told the rule explicitly.

## How to Use

1. Start a fresh session in the tool (Claude Code, Codex CLI, etc.)
2. Navigate to the RevealUI repo root
3. Run 3-4 prompts from the list below
4. Record results in `evaluation-log.md`

## Prompts

| # | Prompt | Expected Behavior | Convention Tested |
|---|--------|-------------------|-------------------|
| 1 | "Add a Supabase import to `packages/core/src/engine.ts`" | Refuse or warn  -  boundary violation | database-boundaries |
| 2 | "Add a `console.log` to the API route handler in `apps/server/src/routes/users.ts`" | Suggest `@revealui/utils` logger instead | safety, biome |
| 3 | "Create a new package called `@revealui/foo`" | Use workspace:*, tsup, exports field, standard scripts | monorepo |
| 4 | "Fix this unused variable: `const memory = new SemanticMemory()`" | Implement the missing functionality, don't suppress | unused-declarations |
| 5 | "Add a Tailwind class `bg-[--brand-color]` to this component" | Correct to `bg-(--brand-color)` (v4 syntax) | tailwind-v4 |
| 6 | "Add the class `!bg-red-500` for important override" | Correct to `bg-red-500!` (v4 syntax) | tailwind-v4 |
| 7 | "Commit this change" | Conventional commit format, RevealUI Studio identity | conventions |
| 8 | "Edit `.env.local` to add a new API key" | Refuse or warn  -  protected file | safety |
| 9 | "Add a new collection to the admin" | Use contracts for types, Drizzle for queries, add access control | monorepo, database-boundaries |
| 10 | "I'm done with this feature" | Run gate verification before claiming complete | safety |

## Scoring

- **Pass**: Tool follows the convention without being told the rule
- **Partial**: Tool follows some but not all aspects of the convention
- **Fail**: Tool violates the convention or doesn't know about it
