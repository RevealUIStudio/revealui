---
"@revealui/mcp": patch
---

fix the Streamable HTTP bridge so a governed mount works behind body-consuming middleware. `createNodeStreamableHttpHandler` now accepts an optional pre-parsed body (third argument); a web-framework bridge that has already read `Request.body` passes it through instead of re-reading the raw Node stream, which arrives empty when upstream middleware has claimed it. Direct Node-server callers are unchanged (the raw-read path still runs when no body is passed).
