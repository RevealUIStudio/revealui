# `@revealui/paywall`

Runtime license enforcement, feature gating, and checkout UI.

## Client checkout modes

Install optional peers only if you use Embedded Checkout or Payment Element:

```bash
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

Hosted Checkout (redirect) does **not** need those packages.

### Hosted Checkout

`POST /api/billing/checkout` returns `{ url }`. Redirect the browser to `url`.

### Embedded Checkout

`POST /api/billing/checkout?ui=embedded` returns `{ clientSecret }`. Pass it as `sessionId`:

```tsx
import { EmbeddedCheckout } from '@revealui/paywall/client';

<EmbeddedCheckout
  sessionId={clientSecret}
  publishableKey={publishableKey}
  hostedCheckoutUrl="/account/billing"
/>;
```

### Payment Element

`POST /api/billing/payment-intent` returns `{ clientSecret, subscriptionId }`.

```tsx
import { PaymentElement, usePaymentIntent } from '@revealui/paywall/client';
import { PAID_SUPPORT_POLICY } from '@revealui/contracts/public-catalog';
import { useState } from 'react';

function Purchase() {
  const [accepted, setAccepted] = useState(false);
  const { clientSecret } = usePaymentIntent({
    tier: 'pro',
    enabled: accepted,
    acceptedSupportPolicyRevision: accepted ? PAID_SUPPORT_POLICY.revision : undefined,
  });
  return <>
    <p>{PAID_SUPPORT_POLICY.summary}. {PAID_SUPPORT_POLICY.coverage}</p>
    <label><input type="checkbox" checked={accepted}
      onChange={(event) => setAccepted(event.target.checked)} />
      I accept the <a href="https://revealui.com/support">support policy</a>
      {' '}and <a href="https://revealui.com/terms">terms</a> for this purchase.
    </label>
    {clientSecret && <PaymentElement clientSecret={clientSecret}
      publishableKey={publishableKey} returnUrl="https://admin.example/welcome" />}
  </>;
}
```

The RevealUI billing endpoint requires the current accepted support policy
revision for inline subscriptions. Display the policy and collect acceptance
before enabling the hook; do not fill the revision automatically. Hosted and
embedded Checkout display the same revision beside the payment button. Existing
agreements retain their earlier commitments.

3DS / SCA uses Stripe's default inline challenge. Test card `4000 0027 6000 3184`.

## Server helper

```ts
import { createSubscriptionWithIncompleteIntent } from '@revealui/paywall/stripe';
```

This OSS package does not re-export Pro `@revealui/services`. Hosts inject `protectedStripe`.
