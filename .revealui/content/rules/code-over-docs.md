# Code Over Docs

The source code is the single source of truth. Documentation (READMEs, specs,
plans, handoffs, ADRs, comments, gap files, memory) *describes* the system; the
code *defines* it. When any doc and the code disagree, the code is correct and
the doc is stale.

## Apply every session

1. **Verify against code before acting.** Never implement, review, plan, or
   report from a doc claim alone. Load-bearing claims need `file:line` in
   actual source (or a test that exercises the path).
2. **On disagreement: trust code, then fix the doc.** A doc↔code conflict is a
   doc bug. Do not "fix" working code to match stale prose without an explicit
   decision that the doc's behavior is the intended one.
3. **Doc-tier authority is subordinate.** Handoff / plan tiers resolve
   doc-vs-doc conflicts only. Code outranks all tiers on factual system
   behavior.
4. **Prioritize code work over doc work.** Correct code outranks nicer prose
   about code. Doc sweeps ride behind the code fixes they describe.
5. **Comments are docs too.** Stale headers or comments are drift; the code
   path below them is what you trust.

## Explicitly rejected

- Treating gap files, handoffs, or ADRs as proof of runtime behavior
- Marking exhaustive / md-truth claims verified without reading the file body
- Shipping doc-only "fixes" that leave wrong code unchanged

## References

- Sibling: quality-over-speed, durable-solutions, tracker-first
- Exhaustive / md-truth programs prove claims against code, not against docs
