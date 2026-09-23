---
visibility: internal
status: verified
audience: maintainer
title: GAP-169 historical Supabase prefix erzpwtonzo inventory
description: Search inventory for the retired Supabase project prefix erzpwtonzo. The project is dead and not live as of 2026-09-23. Historical hits only. No bot deletion and no key rotation.
last-updated: 2026-09-23
classification: internal
---

# GAP-169: inventory of historical prefix `erzpwtonzo`

## Result

Zero remaining references on the current tree of `origin/test` (`f2658af69cbe9f9f381fa13062127ee6a8fbdb0b`) and on every local and remote ref tip searched on 2026-09-23.

This inventory does not delete the historical Supabase project, rotate keys, or edit production config. A bot must not delete the project.

## Search method

Searched on 2026-09-23 from a full clone of `RevealUIStudio/revealui`, base `origin/test` at `f2658af69`.

1. Working tree, case-insensitive, including ignored files, skipping `.git` and `node_modules`: `rg -n --hidden --no-ignore -i erzpwtonzo`. The shorter stem `erzpwton` was searched the same way. Both returned no matches.
2. `git grep -n -i erzpwtonzo origin/test`. No matches.
3. The same `git grep` against every ref tip from `git for-each-ref` (branches and tags). No ref tip tree contains the prefix.
4. History pickaxe `git log --all -S erzpwtonzo` and the case-insensitive form. Those commits are historical. They are not files on current ref tips.

Generic example hosts such as `your-project.supabase.co` and `db.xxx.supabase.co` still appear in docs and tests. They are historical-style templates and do not contain this prefix.

## Current hits

None. No live config and no docs file on `origin/test` at `f2658af69` contains the prefix.

| Path | Line | Classification |
|------|------|----------------|
| — | — | No current hit |

## Historical hits

These paths contained the prefix in older commits. None of these paths exist on `origin/test` or `origin/main`. Context is summarized without credentials and without the full project id.

| Path | Last seen | Classification | Context (no secrets) |
|------|-----------|----------------|----------------------|
| `scripts/setup-sync-schema-simple.ts` | Removed in `198ea3374` (2026-01-25). Last test/main tree that still had the file: `6c2b941f`. | Historical. Was a setup script, not live config. | Hardcoded Postgres URL whose user or host included the prefix. |
| `validation-report.json` | Removed in `3052e853e` (2026-01-22). | Historical test output, not live config. | Assertion text mentioned an `https` URL whose host included the prefix. |
| `docs/migration/NEXT_STEPS.md` | Removed in `296f46643` (2026-01-18). Added in `ae9173228`. | Historical docs. | Commented URL, project id, database URI, and a dashboard link included the prefix. |
| `.env.backup` | Commit `77b64f020` (2026-01-12). Not an ancestor of `origin/test` or `origin/main`. Reachable from old package tag history such as `@revealui/auth@0.2.0`. The tag tip trees do not contain the prefix. | Historical env-shaped file, not current config. | `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` hosts included the prefix. Historical only. |
| `.env.clean` | Commits `77b64f020` and `9b0ee1c57`. Same tag-history reachability. Not an ancestor of `origin/test` or `origin/main`. | Historical env-shaped file, not current config. | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, and `SUPABASE_PROJECT_ID` included the prefix. Historical only. |

## Owner ruling (2026-09-23)

Joshua ruled on 2026-09-23:

- The Supabase project for prefix `erzpwtonzo` is dead. It is not live.
- A bot must not delete the Supabase project.
- Dashboard cleanup, if still needed, is owner-only.

## Owner action

The live-or-dead question is settled by the owner ruling above. This document does not delete that project or rotate keys. Any remaining dashboard cleanup is owner-only.
