# Extend Before Create — Obligatory Reuse and Consolidation

**Status:** convention. Applies before building anything new.

## The rule

1. **Never create what you can extend.** Before building anything new
   (package, script, hook, API, component, doc, workflow), find the existing
   implementation and enhance or extend it. Creating something net-new
   requires that an audit has shown nothing extensible exists, and the
   PR or spec should say so explicitly ("extends X" or "nothing to extend
   because Y").
2. **Consolidate on contact.** Duplication, redundancy, and incomplete
   wiring or consumption discovered during any task get flagged, even when
   out of scope, and folded in when the fix is cheap. A half-adopted part
   that's built but never wired up counts as drift the same as a literal
   copy.
3. **Converge on one implementation, many consumers.** When a project has a
   shared library or native primitive for something, call that one
   implementation everywhere rather than growing bespoke one-offs beside it.
   Third-party or hand-rolled alternatives need the same carve-out
   discipline: durable, documented exceptions only.
4. **Intentional duplication survives.** Decoupling, avoiding circular
   dependencies, and test isolation are legitimate reasons to duplicate on
   purpose. Classify before consolidating: only accidental duplication is
   debt.

## Where discovered redundancy goes

Track fleet-wide or project-wide consolidation work as its own backlog item,
separate from the task that discovered it, so cleanup work doesn't silently
block or get lost inside an unrelated PR. Per-discovery items go to whatever
backlog or issue tracker the project uses.
