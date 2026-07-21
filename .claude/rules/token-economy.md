# Token Economy — Spend Tokens Only Where They Buy Value

**Status:** convention, owner directive 2026-07-16. Governs the *amount of work*
sent to any model, tool, loop, or automation (the companion to model routing,
which picks the cheapest *capable* model).

## The principle

Every token spent must buy proportional value. Tokens are a real cost — to you
now and to anyone running this fleet later — so the default is the smallest
amount of work that reaches a correct, verified result. Thoroughness is not the
enemy: a deep audit that prevents a wrong merge is worth thousands of tokens.
Waste is spend that changes nothing — polling that a notification would have
delivered for free, a re-read of a file you just wrote, a subagent whose answer
you already had. Cut the second kind, never the first.

## Loops, wakeups, and polling (the biggest avoidable drain)

- **Never poll for background work the harness already tracks.** Background
  agents and long-running commands re-invoke you automatically on completion.
  Scheduling a wakeup or loop tick to "check on" them spends tokens to learn
  what you'd have been told for free. Wait for the notification.
- **Never schedule wakeups to keep a prompt cache warm.** The session cache
  already covers the allowed delay range; extra wakeups are pure waste.
- **Match any real loop's cadence to what it waits on.** An ~8-minute CI run
  gets one ~480s check, not eight 60s ones. Idle heartbeats default to
  1200–1800s.
- **Stop a loop the moment it stops advancing work.** Three consecutive
  "nothing actionable" ticks means scale back to one quick check and stop. If a
  loop is only polling auto-notified work, stop it entirely. When in doubt,
  pause rather than keep ticking — it can always be resumed.
- **Surface and stop, don't silently burn.** If an automation is spending
  tokens for no forward progress, end it and say so in one line.

## Tools, skills, subagents, workflows

- **Invoke for a result you don't already have, not for form's sake.** Don't run
  a search whose answer is in context; don't re-read a file you just wrote;
  don't re-derive a fact the transcript already established.
- **One broad delegation beats many narrow calls.** Send one well-scoped
  agent/search and keep the conclusion, rather than dozens of round-trips whose
  intermediate output you don't need.
- **Don't double-run delegated work.** Once a subagent owns a search or build,
  don't also do it yourself — wait for its result.
- **Reserve fan-out for proportional payoff.** Dozens of agents are right for a
  genuine audit or migration; waste for a task one context can hold.
- **Batch and cache external calls.** Make independent calls in one turn so they
  run in parallel; don't refetch a URL/result already in context.

## Verification is proportional, not skipped

Right-sizing spend never means skipping verification on risky changes. Prove
tests red before claiming a fix, drive the real flow on product changes, run the
gate before a push. The economy is in not re-verifying what's already proven and
not re-reading what can't have changed — never in cutting the check that catches
a real bug. Correctness and authorization always outrank economy.
