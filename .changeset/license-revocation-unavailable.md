---
'@revealui/db': patch
---

Throw a typed `JtiRevocationUnavailableError` when the license JTI authority cannot be read, instead of reporting an unconfirmed token as not revoked. Confirmed absent rows and sticky revocations keep their existing semantics; callers must deny authorization while the lookup is unavailable.
