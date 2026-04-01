---
"@revealui/services": minor
---

refactor(services): remove legacy Supabase-era billing handlers

Removed 15 dead API handler files and 10 legacy test files (~5,900 lines) that were
fully replaced by production handlers in apps/api during the NeonDB migration.
Relocated createPaymentIntent from api/handlers/ to stripe/ subpath.

Breaking: `@revealui/services/api/handlers/payment-intent` is now `@revealui/services/stripe/payment-intent`
