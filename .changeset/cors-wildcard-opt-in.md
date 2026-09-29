---
"@revealui/security": minor
---

Require an explicit opt-in before the permissive and api CORS presets use a wildcard origin. Calls without that flag keep a closed origin list. Method, header, and credential settings stay the same.
