---
"@revealui/harnesses": patch
---

Pin `parseOpenCodeRunOutput` (GAP-371 Phase 4) against the real `opencode run --format json` output shape, verified live against opencode 1.18.3: newline-delimited JSON (JSONL) events, one per line, not a single JSON document. The parser now extracts the assistant's final `text` event from a real turn instead of mis-treating the JSONL stream as invalid JSON and echoing it back verbatim.
