---
'@revealui/security': minor
---

Add `sanitizeHtml` — tag + attribute allow-list HTML sanitizer for Lexical render output, admin-facing markdown, and any other untrusted-HTML sink. Backed by parse5's WHATWG-spec tokenizer (same one jsdom and cheerio use) so the parser is never the attack surface.

Baseline allow-list covers rich-text tags (paragraphs, headings, lists, tables, inline formatting, links, images). Unknown tags are unwrapped (children kept, element dropped). Dangerous containers — `script`, `style`, `iframe`, `object`, `embed`, `form`, `svg`, `math`, `template`, `noscript`, `base`, and similar — are dropped with all their children.

Every `on*` event handler, `style` attribute, `srcdoc` attribute, and namespaced attribute (`xlink:href`, etc.) is stripped categorically. URL attributes (`href`, `src`, `cite`) flow through `isSafeUrl` with the correct context, blocking `javascript:`, `vbscript:`, and non-image `data:` schemes. Anchors with `target="_blank"` are hardened with `rel="noopener noreferrer"` automatically.

Corpus-backed: 28 XSS/HTML-injection vectors from the OWASP cheatsheet + 13 safe-input vectors live in `__tests__/sanitize-corpus/html-injection.ts` and grow with every new attack class.

Adds `parse5@^8.0.0` as a runtime dependency.
