---
'@revealui/contracts': patch
---

Add `payment_intent.requires_action` to RELEVANT_STRIPE_WEBHOOK_EVENTS (13 → 14) for 3DS/SCA authentication flows on one-time charges (perpetual licenses, credit bundles, support renewal). Closes GAP-124 surface 5 BLOCKING.
