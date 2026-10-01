# Skill Auto-Use Guidelines

Skill names and descriptions are discovery signals, not proof of suitability.
Before applying a skill, read its actual instructions and required references.
Compare the user's requested result with the skill's required inputs, output
format and destination, scope, prerequisites, side effects, and verification.
Confirm inputs and tools are available and effects are within the user's authority.

Record the assessed source/version, suitability verdict, and material limitations
with the task evidence. Use a suitable skill. For partial fit, use only a safely
separable applicable portion and identify the remaining work. Do not apply an
unsuitable or unverified workflow. An explicitly named skill still requires this
assessment; explain any inability to use it within the requested scope.

After execution, compare observed output with the requested result and the
skill's actual contract. A command exit, model response, write receipt, or ran
flag does not establish task success. Keep execution, tool completion, output
validation, and factual verification distinct; missing evidence stays unverified.

Reassess when instructions, inputs, destination, tools, or execution results
change materially. Reuse a current assessment when its contract is unchanged.
Routine assessment does not require user approval and a skill does not authorize
publication, messages, purchases, or other effects beyond the user's request.

When the Skill tool is available, assess these candidates in the following situations:

## Assess proactively (no user prompt needed)

- `/vercel-react-best-practices`  -  before completing any PR that touches React components or hooks
- `/stripe-best-practices`  -  any time you write or modify billing, payment, webhook, or Stripe code
- `/next-best-practices`  -  when implementing features in apps/admin or apps/marketing
- `/next-cache-components`  -  when adding 'use cache', cache profiles, or PPR to a Next.js route
- `/vercel-composition-patterns`  -  when adding new components to @revealui/presentation
- `/web-design-guidelines`  -  when asked to review a UI, page, or component for quality
- `/review`  -  when the user asks for a code review, asks to "check" or "look at" code
- `/add-tests`  -  when the user asks to write tests or add coverage for a specific file
- `/audit`  -  before any release or after a large refactor touching multiple packages
- `/turborepo`  -  when modifying turbo.json, pipeline configuration, or monorepo task dependencies

## Only invoke on explicit user request (disable-model-invocation: true)

- `/gate`  -  user must explicitly ask to run the gate
- `/sync-lts`  -  user must explicitly ask to sync or backup
- `/new-package`  -  user must explicitly ask to scaffold a package
- `/new-professional-project`  -  user must explicitly ask to create a project
- `/vercel-deploy`  -  user must explicitly ask to deploy
- `/deploy-check`  -  user must explicitly ask for pre-deploy check
- `/db-migrate`  -  user must explicitly ask to create or apply database migrations
- `/preflight`  -  user must explicitly ask to run the preflight checklist

## When in doubt

Read the actual contract rather than inferring behavior from a matching description.
Choose guidance that produces the requested result within the authorized scope.
Identify missing inputs or evidence and continue independent work where possible.
