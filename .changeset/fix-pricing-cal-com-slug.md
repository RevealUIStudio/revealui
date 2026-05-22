---
"@revealui/contracts": patch
---

Fix the `SERVICE_OFFERINGS` discovery-call `ctaHref` slug. `cal.com/revealuistudio/revealui-discovery-call` returns HTTP 404; the live event slug is `discovery`. These offerings are dormant (the pricing API intentionally returns `services: []` until the `service` billing track is built), but the data is now correct for when they're wired — and the agency site already uses the correct `/discovery` link.
