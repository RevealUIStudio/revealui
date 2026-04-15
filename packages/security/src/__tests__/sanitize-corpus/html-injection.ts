/**
 * XSS / HTML-injection attack corpus for `sanitizeHtml`.
 *
 * Vectors drawn from OWASP XSS Filter Evasion Cheat Sheet, the HTML5
 * Security Cheatsheet, and the parse-quirk classes that DOMPurify and
 * sanitize-html historically patched. Grouped by attack family so
 * regressions are diagnosable.
 *
 * Each `DangerousHtmlVector` captures the rationale and a substring
 * (`mustNotContain`) that MUST NOT survive sanitization. Tests assert
 * the substring is gone and that no `on*`/`javascript:`/`<script>` or
 * dangerous-container tag leaks through.
 */

export interface DangerousHtmlVector {
  input: string;
  mustNotContain: readonly string[];
  rationale: string;
}

export interface SafeHtmlVector {
  input: string;
  mustContain: readonly string[];
  rationale: string;
}

export const DANGEROUS_HTML_VECTORS: readonly DangerousHtmlVector[] = [
  {
    input: '<script>alert(1)</script>',
    mustNotContain: ['<script', 'alert(1)'],
    rationale: 'plain script tag — contents must be dropped, not just unwrapped',
  },
  {
    input: '<ScRiPt>alert(1)</ScRiPt>',
    mustNotContain: ['alert(1)'],
    rationale: 'mixed case script — tag match must be case-insensitive',
  },
  {
    input: '<img src=x onerror=alert(1)>',
    mustNotContain: ['onerror', 'alert(1)'],
    rationale: 'classic img onerror handler',
  },
  {
    input: '<img src=x OnError=alert(1)>',
    mustNotContain: ['OnError', 'onerror', 'alert(1)'],
    rationale: 'mixed case event handler — attr match must be case-insensitive',
  },
  {
    input: '<a href="javascript:alert(1)">x</a>',
    mustNotContain: ['javascript:'],
    rationale: 'javascript: URL in href',
  },
  {
    input: '<a href=" javascript:alert(1)">x</a>',
    mustNotContain: ['javascript:'],
    rationale: 'leading-space javascript: URL',
  },
  {
    input: '<a href="JaVaScRiPt:alert(1)">x</a>',
    mustNotContain: ['alert(1)'],
    rationale: 'mixed case javascript scheme',
  },
  {
    input: '<a href="&#106;avascript:alert(1)">x</a>',
    mustNotContain: ['javascript:', 'alert(1)'],
    rationale: 'HTML entity encoded `j` — parse5 decodes entities, must still block',
  },
  {
    input: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    mustNotContain: ['data:text/html', '<script'],
    rationale: 'data: URL with HTML payload',
  },
  {
    input: '<svg onload=alert(1)><circle r=10/></svg>',
    mustNotContain: ['<svg', 'onload', 'alert(1)'],
    rationale: 'SVG as script carrier — whole container dropped',
  },
  {
    input: '<iframe src="javascript:alert(1)"></iframe>',
    mustNotContain: ['<iframe', 'javascript:'],
    rationale: 'iframe is a dangerous container',
  },
  {
    input: '<object data="javascript:alert(1)"></object>',
    mustNotContain: ['<object', 'javascript:'],
    rationale: 'object data attr — dangerous container',
  },
  {
    input: '<embed src="javascript:alert(1)">',
    mustNotContain: ['<embed', 'javascript:'],
    rationale: 'embed tag — dangerous container',
  },
  {
    input: '<form action="javascript:alert(1)"><input value=x></form>',
    mustNotContain: ['<form', '<input', 'javascript:'],
    rationale: 'form with JS action — container dropped',
  },
  {
    input: '<style>*{background:url("javascript:alert(1)")}</style>',
    mustNotContain: ['<style', 'javascript:', 'alert(1)'],
    rationale: 'style block — dangerous container, contents dropped',
  },
  {
    input: '<p style="background:url(javascript:alert(1))">x</p>',
    mustNotContain: ['style=', 'javascript:'],
    rationale: 'inline style attr — blocked categorically',
  },
  {
    input: '<div onclick="alert(1)">x</div>',
    mustNotContain: ['onclick', 'alert(1)'],
    rationale: 'onclick handler on otherwise-safe tag',
  },
  {
    input: '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    mustNotContain: ['<math', 'javascript:', 'xlink'],
    rationale: 'MathML foreign content — math is a dangerous container',
  },
  {
    input: '<template><script>alert(1)</script></template>',
    mustNotContain: ['<template', '<script', 'alert(1)'],
    rationale: 'template wraps a DocumentFragment — dangerous container',
  },
  {
    input: '<noscript><p onclick="alert(1)">x</p></noscript>',
    mustNotContain: ['<noscript', 'onclick'],
    rationale: 'noscript content parses under script-disabled mode — drop entirely',
  },
  {
    input: '<img src="x" srcdoc="<script>alert(1)</script>">',
    mustNotContain: ['srcdoc', '<script'],
    rationale: 'srcdoc attr is an iframe escape hatch',
  },
  {
    input: '<a href="http://example.com" target="_blank">x</a>',
    mustNotContain: [],
    rationale: 'benign but needs rel hardening — separate assertion',
  },
  {
    input: '<base href="//evil.example/">',
    mustNotContain: ['<base'],
    rationale: 'base href rewrites relative URLs — dangerous container',
  },
  {
    input: '<!-- <script>alert(1)</script> -->',
    mustNotContain: ['<script', 'alert(1)', '<!--'],
    rationale: 'HTML comments must be stripped — they can encode script on re-parse',
  },
  {
    input: '<p><b><script>alert(1)</script></b></p>',
    mustNotContain: ['<script', 'alert(1)'],
    rationale: 'deeply nested script — recursive walk must reach it',
  },
  {
    input: '<a href="vbscript:msgbox(1)">x</a>',
    mustNotContain: ['vbscript:'],
    rationale: 'legacy IE VBScript protocol',
  },
  {
    input: '<img src="   javascript:alert(1)">',
    mustNotContain: ['javascript:'],
    rationale: 'leading whitespace evasion on src',
  },
  {
    input: '<a href="javascript&colon;alert(1)">x</a>',
    mustNotContain: ['alert(1)'],
    rationale: 'entity-encoded colon — parse5 decodes before we see it',
  },
];

export const SAFE_HTML_VECTORS: readonly SafeHtmlVector[] = [
  {
    input: '<p>hello <strong>world</strong></p>',
    mustContain: ['<p>', '<strong>', 'hello', 'world'],
    rationale: 'plain paragraph with inline bold',
  },
  {
    input: '<a href="https://example.com">link</a>',
    mustContain: ['href="https://example.com"', '>link<'],
    rationale: 'https link preserved',
  },
  {
    input: '<a href="mailto:founder@revealui.com">mail</a>',
    mustContain: ['mailto:founder@revealui.com'],
    rationale: 'mailto link preserved',
  },
  {
    input: '<a href="#section">anchor</a>',
    mustContain: ['href="#section"'],
    rationale: 'fragment anchor preserved',
  },
  {
    input: '<a href="/relative">rel</a>',
    mustContain: ['href="/relative"'],
    rationale: 'relative URL preserved',
  },
  {
    input: '<img src="https://example.com/x.png" alt="x">',
    mustContain: ['src="https://example.com/x.png"', 'alt="x"'],
    rationale: 'https image preserved',
  },
  {
    input: '<img src="data:image/png;base64,iVBORw0KG" alt="x">',
    mustContain: ['data:image/png'],
    rationale: 'data:image/ URI preserved on img',
  },
  {
    input: '<ul><li>one</li><li>two</li></ul>',
    mustContain: ['<ul>', '<li>', 'one', 'two'],
    rationale: 'list structure preserved',
  },
  {
    input: '<table><tr><th>k</th><td>v</td></tr></table>',
    mustContain: ['<table>', '<th>', '<td>'],
    rationale: 'table structure preserved (tbody may be injected by parse5)',
  },
  {
    input: '<blockquote cite="https://example.com/src">q</blockquote>',
    mustContain: ['<blockquote', 'cite="https://example.com/src"', 'q</blockquote>'],
    rationale: 'blockquote cite (URL-filtered) preserved',
  },
  {
    input: '<pre data-language="ts"><code>const x = 1</code></pre>',
    mustContain: ['data-language="ts"', '<code>', 'const x = 1'],
    rationale: 'data-* attrs allowed on all tags',
  },
  {
    input: '<p class="note" aria-label="info">hi</p>',
    mustContain: ['class="note"', 'aria-label="info"'],
    rationale: 'class and aria-* preserved',
  },
  {
    input: '<custom-tag>fallback text</custom-tag>',
    mustContain: ['fallback text'],
    rationale: 'unknown tag unwrapped — children preserved',
  },
];
