---
title: "Sanitization Attack Corpus"
description: "Categorised attack vectors exercised by the `sanitize.test.ts` suite. Each file"
visibility: internal
status: verified
audience: maintainer
---

# Sanitization Attack Corpus

Categorised attack vectors exercised by the `sanitize.test.ts` suite. Each file
exports a `const` array of `{ input, rationale }` entries.

Add new vectors here rather than inline in test files, every new sink added to
`@revealui/security` should expand the corpus with the class of bug it prevents.

**Categories:**

- `ansi-injection.ts`, terminal escape / OSC / CSI / DCS sequences. Sink: xterm.js banner.
- `html-injection.ts`, XSS / HTML-injection vectors for `sanitizeHtml`, drawn from the OWASP XSS Filter Evasion Cheat Sheet and the HTML5 Security Cheatsheet. Sink: rendered HTML.
- `log-redaction.ts`, keys and values that must always be redacted in structured logs, regardless of content. Sink: logger output.
- `scheme-confusion.ts`, `javascript:` / `vbscript:` / `data:` URL smuggling. Sink: href/src attribute.
- `shell-injection.ts`, command / argument injection via shell metacharacters. Sink: exec/spawn with `shell: true`.
- `sql-injection.ts`, legal-but-evil or malformed identifiers for `escapeSqlIdentifier`. Sink: table/column/schema names flowing through runtime interpolation (literal-value injection is out of scope; that's handled by parameterised queries).
