/**
 * Shared types for `@revealui/paywall/stripe`.
 *
 * `ProtectedStripe` is a duck type so this OSS package never imports
 * `@revealui/services` (Pro). Hosts inject their circuit-broken Stripe client.
 */

export type PaidTier = 'pro' | 'max' | 'enterprise';
export type BillingCatalogKind = 'subscription' | 'perpetual' | 'credits' | 'renewal';
export type LicenseTier = 'free' | PaidTier;

export interface EarlyAdopterConfig {
  endDate: Date | null;
  coupons: Record<string, string | undefined>;
}

export interface RequestEntitlements {
  accountId?: string | null;
  subscriptionStatus?: string | null;
  tier?: LicenseTier;
  limits?: {
    maxAgentTasks?: number;
  };
}

export interface CheckoutMetadata {
  metadata: Record<string, string>;
  payment_intent_data: { metadata: Record<string, string> };
}

export type StripeRefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer';

export interface RefundResult {
  refundId: string;
  status: string;
  amount: number;
  currency: string;
}

export interface OverageRow {
  userId: string;
  overage: number;
  stripeCustomerId: string | null;
}

export interface SubscriptionSnapshot {
  tier: LicenseTier;
  status: string;
  graceUntil: string | null;
}

/**
 * Minimal Stripe surface used by extracted helpers.
 *
 * Method signatures are a lower bound the host `protectedStripe` wrapper
 * satisfies. Live Stripe `Customer.deleted` is `void`; deleted customers use
 * `deleted: true`. Type `deleted` as `unknown` (not `boolean`) so the real
 * Stripe client is assignable (GAP-177 CI typecheck).
 */
export interface ProtectedStripe {
  customers: {
    retrieve: (id: string) => Promise<{ id?: string; deleted?: unknown }>;
    create: (
      params: { email: string; metadata: Record<string, string> },
      opts?: { idempotencyKey?: string },
    ) => Promise<{ id: string }>;
  };
  refunds: {
    create: (
      params: {
        payment_intent?: string;
        charge?: string;
        amount?: number;
        reason?: StripeRefundReason;
      },
      opts?: { idempotencyKey?: string },
    ) => Promise<{
      id: string;
      amount: number;
      status: string | null;
      currency: string;
    }>;
  };
  billing: {
    meterEvents: {
      create: (
        params: {
          event_name: string;
          payload: Record<string, string>;
          timestamp: number;
        },
        opts?: { idempotencyKey?: string },
      ) => Promise<unknown>;
    };
  };
  subscriptions: {
    create: (
      params: {
        customer: string;
        items: Array<{ price: string }>;
        payment_behavior: 'default_incomplete';
        payment_settings?: { save_default_payment_method?: 'on_subscription' };
        expand?: string[];
        metadata?: Record<string, string>;
      },
      opts?: { idempotencyKey?: string },
    ) => Promise<{
      id: string;
      status: string;
      latest_invoice?:
        | string
        | null
        | {
            payment_intent?: string | null | { client_secret?: string | null };
          };
    }>;
  };
}

export interface IncompleteSubscriptionIntent {
  subscriptionId: string;
  clientSecret: string;
  status: string;
}

export interface PgPoolLike {
  connect: () => Promise<{
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
    release: () => void;
  }>;
}

export class PaywallBillingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaywallBillingError';
    this.status = status;
  }
}
