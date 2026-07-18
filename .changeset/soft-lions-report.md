---
"@revealui/core": minor
---

Derive hosted subscription license JWT expiry from the Stripe billing period instead of a flat one year. New license issuer exports back the period-bound mint and renewal cadence: `RENEWAL_SLACK_DAYS` / `RENEWAL_SLACK_SECONDS`, `DEFAULT_SUBSCRIPTION_TTL_SECONDS`, `subscriptionLicenseExpiresInSeconds` (derives `period_end + 7d` slack, falling back to the one-year default when a subscription has no billing period), `subscriptionExpBound`, and `readLicenseExp` (unverified exp read for the re-mint decision). Perpetual and manual mints are unchanged.
