---
title: "Building a Codebase With Zero Hand-Written Regex"
description: "We banned authored regex across the fleet. Here is what we use instead, and why it made the code safer and easier to read."
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

There is a rule across the entire RevFleet codebase that surprises people: no hand-written regular expressions. Not "use them sparingly." Zero authored regex, enforced in CI.

This sounds like an aesthetic preference. It is actually a security and maintainability decision, and it has paid for itself many times over.

## Why regex is a liability, not a tool

A regular expression is write-only code. You write one that works on your three test cases, ship it, and a year later nobody on the team, including the author, can say with confidence what it accepts and what it rejects. Bugs hide in the gap between what you meant and what the pattern actually matches.

Worse, some regex patterns are a denial-of-service vector. Catastrophic backtracking lets a short, innocent-looking input pin a CPU core for seconds:

```js
// A classic ReDoS pattern. Feed it "aaaaaaaaaaaaaaaaaaaaaaaa!"
// and watch one CPU core melt.
const looksValid = /^(a+)+$/;
looksValid.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"); // hangs
```

That pattern is the kind of thing that ends up in an input validator, looks fine in review, passes the tests, and becomes an outage the first time an attacker sends a crafted string. Banning the whole category removes the foot-gun instead of hoping every reviewer spots it.

## What we use instead

For every job regex usually does, there is a clearer, safer tool that says what it means:

- **Parsing structured text** uses real parsers. `URL` for URLs, `JSON.parse` for JSON, `Date.parse` for dates. These are battle-tested, spec-compliant, and they reject malformed input correctly instead of approximately.
- **Walking code and markup** uses AST walkers. We use `mdast` for Markdown, the Lexical tree for rich text, and `@typescript-eslint` for TypeScript. An AST knows the difference between a string literal and an identifier; a regex only sees characters.
- **Membership and lookup** uses `Set` and `Map`. "Is this one of the allowed values" is a `Set.has`, not an alternation you have to keep escaping.
- **Splitting human text** uses `Intl.Segmenter`, which understands graphemes and word boundaries across languages, where a regex quietly mangles anything outside ASCII.
- **Simple shape checks** use typed predicates: `startsWith`, `endsWith`, `includes`, and small hand-written functions that a human can read in one pass.

Library APIs that happen to wrap a tested pattern are fine. Zod's `.email()` is a typed contract, not a regex you maintain. The line is about regex you author and own, because that is the regex that bites you.

## The one exception, kept on a short leash

Some third-party tools only accept configuration as a regex string: a linter ignore pattern, a scanner allowlist. We do not pretend those away. Each one is marked with a `// REGEX-CONFIG-BOUNDARY` comment, kept as small as possible, and isolated so it is obvious it is a boundary with someone else's API, not logic we wrote.

## How the rule pays off in practice

The most satisfying proof is the tooling that enforces our own claims. The validator that keeps our marketing numbers honest has to count things in the repo, like how many test cases live in a suite. The obvious implementation is a regex over the file. Ours is not:

```ts
for (const line of content.split('\n')) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('it(') || trimmed.startsWith('test(')) count++;
}
```

Anyone can read that and know exactly what it counts. There is no pattern to misremember, no edge case lurking in a quantifier, and nothing for a malicious input to exploit. We have an AST-based analyzer in CI that hunts for the dangerous patterns regex tends to hide, command injection, time-of-check-to-time-of-use races, and ReDoS, and the no-regex rule means it has far less to hunt for.

## The trade-off

The honest cost is line count. A typed predicate or a small parser-driven function is sometimes longer than the one-liner regex it replaces. We take that trade every time, because the longer version is the one a teammate can read at 11pm before a launch and actually trust.

Readable, reviewable, and safe beats clever and opaque. For code you intend to run for years, that is not a close call.

---

*RevealUI is the open runtime for businesses that run their own AI. Read how we build it in the [docs](https://docs.revealui.com).*
