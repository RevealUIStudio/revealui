# Quality Over Speed (standing order)

**Quality is always the primary metric** for code, config, and documentation.
Speed is a lagging benefit of good systems and better hardware/pricing — not a
reason to ship weak work, thin proofs, or dual-home shortcuts.

## Apply every session (including concurrent multi-agent work)

1. **Correctness first.** Prove red→green where tests apply. Prefer root-cause
   durable fixes over hotfixes (register any unavoidable hotfix the same turn).
2. **Proof over pace.** Claims about system behavior need `code:line` or test
   evidence (code-over-docs). Doc edits without proof are incomplete.
3. **One solid change beats three rushed ones.** Do not expand scope to "finish
   the wave" if quality drops. Stop at a clean PR boundary.
4. **Concurrency does not lower the bar.** Parallel sessions still use exclusive
   shards/worktrees, full gates for risk level, and no self-merge of security or
   unreviewed work. Faster calendar time is worthless if two agents thrash the
   same surface or invent parallel queues.
5. **Manager + adapters.** Shared policy lives under `.revealui` / package
   definitions. Do not mirror hardlines into vendor homes "to go faster."

## Explicitly rejected

- Skipping tests, audits, or claim proof to close a session sooner
- Partial file reads marked verified in exhaustive / md-truth ledgers
- Dual-writing the same rule into Claude and Grok homes
- Merging or force-pushing to "unblock" without owner disposition when required

## When pressed for speed

Reduce **scope**, not **quality**. Ship a smaller correct slice; leave the rest
as TRACKER gaps/lanes with acceptance criteria intact.
