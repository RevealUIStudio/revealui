---
'@revealui/ai': minor
---

Extend the BYOK key validator with the GAP-360 hosted providers: anthropic, openai, and xai keys are now probed against their models endpoints (401/403 rejects, outages never block storage), and inference-snaps joins ollama as an accepted local provider. Base URL env overrides (ANTHROPIC_BASE_URL, OPENAI_BASE_URL, XAI_BASE_URL) are honored, matching the env factory.
