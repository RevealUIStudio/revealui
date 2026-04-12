import type { Rule } from '../../schemas/rule.js';

export const unusedDeclarationsRule: Rule = {
  id: 'unused-declarations',
  tier: 'oss',
  name: 'Unused Declarations Policy',
  description:
    'Never suppress unused warnings without determining if code is incomplete  -  implement first',
  scope: 'project',
  preambleTier: 3,
  tags: ['lint', 'quality', 'policy'],
  content: `# Unused Declarations Policy

## Core Rule

**NEVER suppress an unused variable/import warning without first determining if the code is incomplete.**

Unused declarations in this codebase frequently signal incomplete implementations  -  stubs, scaffolded functions, planned integrations  -  not dead code. Suppressing the warning without completing the code leads to permanent placeholders that silently rot.

---

## Mandatory Decision Tree

When you encounter an \`no-unused-vars\`, \`noUnusedVariables\`, or \`noUnusedFunctionParameters\` warning, you MUST follow this decision tree **before taking any action**:

\`\`\`
1. Is the declaration a stub or placeholder?
   └─ Signs: empty function body, \`// TODO\`, \`throw new Error('not implemented')\`,
             adjacent commented-out code, file has <10 lines of real logic,
             variable name matches a feature that exists elsewhere in the codebase
   └─ Action: IMPLEMENT the missing functionality. Do not suppress.

2. Is the declaration an intentionally-created side-effect resource?
   └─ Signs: infrastructure-as-code (Pulumi/CDK), event listener registration,
             DB migration runner, resource that must exist but isn't referenced
   └─ Action: Rename with \`_\` prefix to signal intentional non-use.
              Add a comment explaining WHY it exists.

3. Is the import used only as a type (TypeScript)?
   └─ Signs: import is from a types package, used only in \`type X = ...\` expressions
   └─ Action: Change to \`import type { ... }\`  -  Biome will no longer flag it.

4. Is the parameter required by a callback signature you don't control?
   └─ Signs: Express/Hono middleware \`(req, res, next)\`, event handler \`(event, context)\`,
             interface implementation where all params are mandated
   └─ Action: Prefix with \`_\` (e.g. \`_req\`, \`_event\`). Add a comment if non-obvious.

5. Is it genuinely dead code with no planned use?
   └─ Signs: feature was removed, import was replaced, duplicate of another symbol
   └─ Action: DELETE the declaration entirely. Per the Legacy Code Removal Policy,
              no grace periods  -  remove it and all call sites in the same change.
\`\`\`

---

## What "Implement" Means

When you determine a declaration is incomplete (case 1), the required steps are:

1. **Search the codebase** for related implementations, types, interfaces, and tests that reveal intent.
2. **Check the plan file** at \`~/.claude/plans/\` for any documented phase covering this feature.
3. **Check for contracts** in \`packages/contracts/src/\`  -  the schema often describes the expected behavior.
4. **Implement the function/class/module** based on what the surrounding code expects.
5. **Run \`pnpm gate:quick\`** after implementing to verify no new errors were introduced.

Do NOT:
- Add \`// biome-ignore lint/correctness/noUnusedVariables: TODO implement\`
- Rename to \`_variable\` just to silence the warning when the variable should be used
- Delete a stub that represents planned functionality without implementing it first

---

## Examples

### Wrong  -  suppressing an incomplete stub
\`\`\`ts
// biome-ignore lint/correctness/noUnusedVariables: TODO
const semanticMemory = new SemanticMemory()
\`\`\`

### Right  -  implement it
\`\`\`ts
const semanticMemory = new SemanticMemory()
await semanticMemory.store('key', content, embedding)
\`\`\`

---

### Wrong  -  deleting a planned integration
\`\`\`ts
// Was: import { ProceduralMemory } from './procedural-memory.js'
// Deleted because "unused"
\`\`\`

### Right  -  implement the module it was waiting for
\`\`\`ts
// packages/ai/src/memory/memory/procedural-memory.ts
export class ProceduralMemory { ... }
// Then use it where the original import was
\`\`\`

---

### Wrong  -  renaming away the signal
\`\`\`ts
// Original: const routeTableAssoc = new aws.ec2.RouteTableAssociation(...)
// "Fixed": const _routeTableAssoc = new aws.ec2.RouteTableAssociation(...)
// No comment explaining why
\`\`\`

### Right  -  rename AND document
\`\`\`ts
// Route table association must exist for subnet routing to function.
// The variable is not referenced after creation; AWS manages the association.
const _routeTableAssoc = new aws.ec2.RouteTableAssociation(...)
\`\`\`

---

## Verification Step After Any Lint Fix

After resolving any unused declaration warning, run:

\`\`\`bash
# Confirm the fix compiles
pnpm --filter <package> typecheck

# Confirm Biome is clean on the changed file
node_modules/.bin/biome check <file>

# If the declaration was a stub that you implemented, run the tests
pnpm --filter <package> test
\`\`\`

Never move to the next task without completing this verification.

---

## Relationship to Gate Verification Rule

This policy works in conjunction with the gate verification rule: complete the implementation → verify with lint/type/test → then move on. The gate catches regressions; this policy prevents incomplete code from silently accumulating.`,
};
