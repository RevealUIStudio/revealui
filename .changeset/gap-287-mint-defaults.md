---
'@revealui/core': minor
---

Drop the admin `POST /generate` manual-mint default license JWT lifetime from 365 to 90 days via a new named `DEFAULT_MANUAL_MINT_DAYS` constant (an explicit `expiresInDays` on the request is still honored unchanged). Name the RevForge kit mint's existing 365-day default as `DEFAULT_KIT_MINT_DAYS` in `revforge-license.ts` (no behavior change). Perpetual mint paths remain exempt and unchanged. Completes the GAP-287 shorter-lived license JWT program (PR-3 of 3).
