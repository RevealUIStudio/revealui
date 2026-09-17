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

const { clientSecret } = usePaymentIntent();
{clientSecret ? (
  <PaymentElement
    clientSecret={clientSecret}
    publishableKey={publishableKey}
    returnUrl="https://admin.example/welcome"
  />
) : null}
```

3DS / SCA uses Stripe's default inline challenge. Test card `4000 0027 6000 3184`.

## Server helper

```ts
import { createSubscriptionWithIncompleteIntent } from '@revealui/paywall/stripe';
```

This OSS package does not re-export Pro `@revealui/services`. Hosts inject `protectedStripe`.
