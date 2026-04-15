# Sanitization Attack Corpus

Categorised attack vectors exercised by the `sanitize.test.ts` suite. Each file
exports a `const` array of `{ input, rationale }` entries.

Add new vectors here rather than inline in test files — every new sink added to
`@revealui/security` should expand the corpus with the class of bug it prevents.

**Categories:**

- `ansi-injection.ts` — terminal escape / OSC / CSI / DCS sequences. Sink: xterm.js banner.
- `scheme-confusion.ts` — `javascript:` / `vbscript:` / `data:` URL smuggling. Sink: href/src attribute.
- `shell-injection.ts` — command / argument injection via shell metacharacters. Sink: exec/spawn with `shell: true`.
