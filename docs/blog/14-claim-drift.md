---
title: "The Marketing Site That Fails CI When It Lies"
description: "Every number on revealui.com is checked against the code on every push. When a stat drifts from reality, the build breaks before the lie ships."
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

Marketing numbers rot. A landing page says "65 components," the team ships four more, and now the page is wrong and nobody notices, because the page and the code live in different worlds and no one is paid to keep them in sync.

On revealui.com, that cannot happen. Every count we publish is checked against the actual code on every push, and if a number drifts from the truth, the build fails before the change can merge. The marketing site is not allowed to lie.

## The problem with hand-written stats

Pick any developer-facing site and you will find stale numbers. "Over 200 integrations" when it has been 340 for a year. "12 supported languages" when two were removed. The numbers were true once, typed by hand into a hero section, and then reality moved and the copy did not.

It is not malice, it is structure. The claim and the thing it describes have no connection. Keeping them aligned depends on someone remembering, and someone always forgets.

## One canonical source, imported everywhere

The first half of the fix is a single source of truth. Every number the marketing site can state lives in one typed object, and no page is allowed to hardcode the integer anywhere else.

```ts
// Illustrative shape (numbers are whatever claim-drift counts today;
// see apps/marketing/app/content/site.ts METRICS for the live values).
export const METRICS = {
  packages: 29,        // workspace packages
  uiComponents: 65,    // components in @revealui/presentation
  mcpServers: 13,      // first-party MCP servers
  dbTables: 101,       // Drizzle table declarations
  // ...
} as const;
```

A page that wants to say "65 UI components" imports `METRICS.uiComponents`. It never types `64`. Change the underlying number in one place and the copy follows automatically, on the marketing site, in the docs, and in the product roadmap, with no copy edit at all.

## The validator that does the counting

The second half is a check that proves those numbers are real. On every push, a claim-drift validator walks the docs and the marketing content, finds every place a number sits next to a noun it recognizes, and counts the real thing in the repository. The counts come straight from the source: it reads the components directory, the MCP servers directory, the database schema, and the test suites, and compares each published claim against the live count.

If they match, the build is green. If they do not, it fails loudly with the exact mismatch:

```
claim-drift: docs/blog/09-component-library.md
  UI components: claims 59, actual 60 (UNDERSTATED)
  -> fix the copy or fix the count, but they must agree
```

That hard failure is the whole point. The numbers you read here are not a snapshot someone updated when they remembered. They are a measurement of the code as it exists right now: 31 packages, 65 UI components, 13 first-party MCP servers, 101 database tables, 60 access-control enforcement tests, 5 starter templates. Each one is checked on the commit that publishes it.

## The validator practices what we preach

There is a detail worth calling out. The fleet has a rule against hand-written regular expressions, and the claim-drift validator obeys it. It does not scan files with clever patterns. It splits text into lines, trims them, and uses plain string checks and real parsers to find claims and count code. It even skips fenced code blocks, so the example error message above does not trip the validator on this very page.

So the tool that keeps our marketing honest is itself built to the same standard it enforces: readable, reviewable, and impossible to quietly fool.

## Why bother

This is more discipline than most marketing sites accept, and that is exactly why it is worth writing about. A number you can verify is a number you can trust, and a company that wires "verify before you claim" into its build pipeline is telling you something about how it writes the rest of its code too.

We would rather break our own build than ship a stat we cannot stand behind.

---

*RevealUI is the open runtime for businesses that run their own AI. Every claim on this site is checked against the source; read it for yourself in the [docs](https://docs.revealui.com).*
