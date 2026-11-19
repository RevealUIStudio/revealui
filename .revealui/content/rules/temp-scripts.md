# Temp Scripts — Registered Lifecycle, No Orphans

**Status:** convention.

## The rule

Any one-shot helper file written outside a session's private scratch
directory, meant for later execution by a human (installers, verifiers,
migration helpers, repro scripts), needs a clear lifecycle: registered when
created, and confirmed plus cleaned up once it has served its purpose.
Orphaned helper files left in a home directory or a repo root are drift, the
same as any other dead code.

## Workflow

1. **Register at creation.** Note the file's path, its purpose, and a command
   that proves it worked, wherever the project tracks this (a lightweight
   manifest file, an issue, a checklist item). The point is that the file
   is not invisible the moment it's written.
2. **Confirm after use.** Once the script has been run and its outcome
   verified, run the validation command, then delete the file.
3. **Sweep periodically.** Any session can list pending temp scripts and
   clean up anything that's expired or was never confirmed.

## Why this needs enforcement, not just good intentions

A model asked to "write a quick script to check X" will happily do so and
then move on, leaving the file behind. Session-scoped scratch directories are
exempt from this lifecycle by construction (they're isolated and cleaned up
automatically); anything a human has to run by hand is not scratch, and
should be registered instead of left to rot next to real project files.

## Enforcement

Wire a lightweight check into session-start and session-end hooks (or
whatever automation boundary the project has) that surfaces pending,
unconfirmed temp scripts every time. Warn-only is fine for the "session end"
side (a stop hook usually can't block); the point is that pending debt is
never silently forgotten between sessions.
