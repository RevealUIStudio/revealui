---
'@revealui/contracts': minor
'@revealui/paywall': minor
---

Share the prospective solo-founder support policy across the paid catalog and
purchase flows. RevealUI inline billing requests now require the current
`acceptedSupportPolicyRevision`; consumers must display the policy and collect
acceptance before enabling intent creation. The payment-intent hook supports
deferred creation, selected catalog plans and an explicitly accepted revision.

Keep incomplete-subscription retries stable and distinguish policy revisions in
their idempotency keys. Declare the browser environment used by paywall tests.
Existing accepted support agreements retain their commitments.
