---
'@revealui/ai': minor
---

`createLLMClientFromEnv()` now ships a default `baseURL` for the `inference-snaps` provider — `http://localhost:9090/v1`, matching Canonical's standard Inference Snap port — so a user who sets `LLM_PROVIDER=inference-snaps` but omits `INFERENCE_SNAPS_BASE_URL` hits the local snap without further configuration. Existing deployments that already set `INFERENCE_SNAPS_BASE_URL` are unchanged (env override still wins). Mirrors the existing Ollama default (`http://localhost:11434`).

Also:
- JSDoc now lists `inference-snaps → gemma3` alongside Ollama and Groq in the "Provider defaults" block and names Canonical Inference Snaps as the reference local provider on Ubuntu.
- The "No LLM provider configured" error message now leads with `INFERENCE_SNAPS_BASE_URL` before Ollama and Groq, with a pointer to the provider module's install docs.

Fulfills the Canonical-Inference-Snap-as-reference-provider Stage 5.1/5.2 goal ("ship a documented preset out of the box"). No behavior change for explicit `INFERENCE_SNAPS_BASE_URL` users; no change to auto-detection precedence (still `INFERENCE_SNAPS → GROQ → OLLAMA`).
