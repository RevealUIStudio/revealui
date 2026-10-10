# Control Layer, Not Mirrors

**Status:** convention. States the architecture shared workflow capabilities
should follow.

## The rule

1. **A shared control layer authors workflow capabilities**: hardline rules,
   registries, session-boundary checks, coordination tools. It's the one
   place these are defined.
2. **Harness homes are thin adapters.** Whatever editor or agent CLI a
   session runs in (Claude Code, Grok, Cursor, OpenCode, VS Code, or a
   product's own agents) loads or invokes the control layer's content and
   may run thin hooks that call into it. No harness home owns a second full
   implementation of the same capability.
3. **Bootstrapping under one harness home is transitional, not a fork.** A
   capability may land first under a single tool's config directory for
   dogfooding. Its durable destination is the control layer, and that
   harness config cuts over once the control layer supports it. This is
   tracked as a conversion, never as a permanent "native twin."
4. **Forbidden:** dual-home rules that re-author the same policy in two
   places; full-copy rule bodies kept as a second source of truth instead of
   as pointers or adapters; any setup that keeps one harness as "the real
   product" and another as its copy.

## Why

A project's value is in native, provider-agnostic infrastructure, not in
whichever editor happens to be open. Dual homes re-author the same rule
twice and drift silently, the same failure class as any other unmaintained
copy. The product is the control plane; harness homes consume it rather than
compete with it.

## How to apply

- Shipping a workflow capability? Author it in the control layer first when
  possible. If it has to bootstrap under a single harness's config directory
  for dogfooding, record the control-layer cutover as a tracked follow-up in
  the same change, not as a separate "native twin" ask.
- When rules content needs to travel to multiple harnesses or multiple
  consumer projects, add a lockstep check between the copies rather than
  trusting hand-syncing to hold. See the extend-before-create convention for
  the broader reuse discipline this sits under.
