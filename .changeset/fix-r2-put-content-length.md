---
"@revealui/core": patch
---

Fix the R2 storage provider's `PUT`, which set a manual `Content-Length` header. `Content-Length` is a forbidden `fetch` header that undici computes from the body itself; setting it threw `UND_ERR_INVALID_ARG` ("invalid content-length header") and failed every upload before the request left the process. The header is removed — undici derives the correct length from the body. (Unit tests mock `fetch`, so this only surfaced against a live R2 endpoint.)
