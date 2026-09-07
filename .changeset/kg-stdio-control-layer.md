---
"@revealui/harnesses": patch
"@revealui/mcp": patch
"@revealui/db": patch
---

Studio-local knowledge-graph attach is authored under `.revealui/adapters/grok/mcp.toml` and generated into project `.grok/config.toml` (load path). Never `$HOME/.grok`. The stdio launcher warms the Postgres pool before serving tools so the first kg_* call is not charged connect time against the 4s budget. `track_io_timing` is optional on connect so Neon permission denials do not abort the session.
