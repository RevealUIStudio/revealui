# Priorities

## Source of Truth

All work must align with `docs/MASTER_PLAN.md`. If a task is not listed in the current phase of the master plan, do not work on it without explicit user approval.

## Current Phase: Phase 0 — Prove It Works

The only acceptable work right now:
1. Deploying existing apps (landing, CMS, API)
2. Fixing bugs discovered during deployment
3. Verifying integrations (ElectricSQL, Stripe, email, database)
4. Writing tests for deployed features
5. Updating docs/MASTER_PLAN.md with findings

## Scope Freeze

Do NOT:
- Add new packages or apps
- Add new CI workflows
- Replace dependencies (headlessui, motion, etc.)
- Build new coordination protocols or automation tools
- Expand the AI agent system
- Add new database tables
- Refactor working code

## When in Doubt

Ask: "Does this help deploy and verify what already exists?" If no, defer it.
