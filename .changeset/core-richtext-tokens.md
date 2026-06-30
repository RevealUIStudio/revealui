---
"@revealui/core": patch
---

Brand-token the rich-text editor UI. 21 inline-hex/CSS colors across `client/richtext/RichTextEditor.tsx`, `client/richtext/components/ImageNodeComponent.tsx`, and the `richtext/exports/{server/rsc,client/rcc}.tsx` figcaptions now reference RevealUI brand tokens with the original hex as a literal fallback (e.g. `var(--rvui-brand, #3b82f6)`). No API/behavior change, no new dependency (token-only). The Lexical node-render plumbing structure is unchanged. `observability/alerts.ts` left as-is (its `#FFA500` is a Slack notification-channel color, not UI).
