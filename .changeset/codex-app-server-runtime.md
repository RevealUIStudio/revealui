---
"@revealui/harnesses": minor
---

Add a Codex app-server adapter to the existing harness registry and auto-detection.
Support bounded prompt dispatch, streamed and final output, cancellation and child
cleanup, project-scoped thread resume, canonical stdio MCP attachment, and bounded
request-scoped host approval review. Keep read-only defaults and advertise only
wired capabilities; shared-memory authorization remains with the existing server.

Load CLI command implementations after routing so hook startup avoids unrelated
ACP, inference, and content code without relaxing its subprocess deadline.
