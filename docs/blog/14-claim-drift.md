---
title: "How we keep product claims connected to source"
description: "Defined metrics have automated checks, and covered copy links to cited evidence. Human review still assesses whether a statement is supported."
visibility: public
status: narrative
lastUpdated: "2026-09-30"
audience: user
author: Joshua Vaughn
---

Marketing numbers rot. A landing page says "68 components," the team ships four more, and now the page is wrong and nobody notices, because the page and the code live in different worlds and no one is paid to keep them in sync.

Our claim-drift gate checks defined metrics against repository counts. The claims-evidence gate keeps covered copy linked to its cited artifacts. These checks catch specific kinds of drift; human review still assesses whether the evidence supports a statement.

## The problem with hand-written stats

Pick any developer-facing site and you will find stale numbers. "Over 200 integrations" when it has been 340 for a year. "12 supported languages" when two were removed. The numbers were true once, typed by hand into a hero section, and then reality moved and the copy did not.

It is not malice, it is structure. The claim and the thing it describes have no connection. Keeping them aligned depends on someone remembering, and someone always forgets.

## One canonical source, imported everywhere

The first half of the fix is a single source of truth. Defined marketing metrics live in a maintained typed object. The convention is to import those values and update their source when the underlying count changes.

```ts
// Illustrative shape (numbers are whatever claim-drift counts today;
// see apps/marketing/app/content/site.ts METRICS for the live values).
export const METRICS = {
  packages: 29,        // workspace packages
  uiComponents: 65,    // components in @revealui/presentation
  mcpServers: 14,      // first-party MCP servers
  dbTables: 120,       // Drizzle table declarations
  // ...
} as const;
```

A page that reports a UI component count imports `METRICS.uiComponents` rather than writing a literal count. Imported values follow the maintained object. Literal numbers in dated prose and other surfaces still need review and updates.

## The validator that does the counting

The second half compares covered counts with their defined repository sources. On every push, a claim-drift validator walks the docs and the marketing content, finds every place a number sits next to a noun it recognizes, and counts the real thing in the repository. The counts come straight from the source: it reads the components directory, the MCP servers directory, the database schema, and the test suites, and compares the covered metric claims against the corresponding count.

If they match, the build is green. If they do not, it fails loudly with the exact mismatch:

```
claim-drift: docs/blog/09-component-library.md
  UI components: claims 59, actual 60 (UNDERSTATED)
  -> fix the copy or fix the count, but they must agree
```

That failure makes a covered mismatch visible during validation. Current metrics live in the maintained metrics owner; this dated essay is an explanation of the method, not a live measurement of repository size.

## The validator practices what we preach

There is a detail worth calling out. The fleet has a rule against hand-written regular expressions, and the claim-drift validator obeys it. It does not scan files with clever patterns. It splits text into lines, trims them, and uses plain string checks and real parsers to find claims and count code. It even skips fenced code blocks, so the example error message above does not trip the validator on this very page.

The tooling is public and reviewable. Its checks have defined coverage and can fail or miss cases, so they complement review rather than replace it.

## Why bother

This is more discipline than most marketing sites accept, and that is exactly why it is worth writing about. A number you can verify is a number you can trust, and a company that wires "verify before you claim" into its build pipeline is telling you something about how it writes the rest of its code too.

We would rather break our own build than ship a stat we cannot stand behind.

---

*RevealUI is the open runtime for businesses that run their own AI. Covered claims link to cited evidence and defined metrics have automated checks; inspect the source for yourself in the [docs](https://docs.revealui.com).*
