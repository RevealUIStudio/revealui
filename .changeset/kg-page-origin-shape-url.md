---
"@revealui/sync": patch
---

Knowledge-graph shape hooks now build an absolute same-origin Electric URL and never send a blank `offset`, so hosted admin `/knowledge-graph` can issue `GET /api/shapes/kg-nodes` instead of throwing `Invalid URL` and staying on Loading.
