---
"@revealui/harnesses": minor
---

Make temporary-artifact inspection and sweep read-only. Confirmation now requires explicit SHA-256 completion evidence and retains source files. Stored shell validation is no longer accepted or executed. Add explicit held legacy imports into XDG state, validated atomic registry transactions, conflict detection, and verified public-copy preservation evidence. Artifact removal remains with the owning preservation/custody tool; the registry has no generic removal operation.

Existing callers must replace shell validation and unqualified confirmation with the typed completion contract. Legacy stores remain unchanged until explicitly imported. No live store or adapter migration occurs automatically.
