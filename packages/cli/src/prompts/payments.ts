/**
 * Payment configuration prompts
 */

import { confirm, isCancel, text } from '@clack/prompts';
import { validateStripeKey } from '../validators/credentials.js';

export interface PaymentConfig {
  enabled: boolean;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
}

export async function promptPaymentConfig(): Promise<PaymentConfig> {
  const enabled = await confirm({
    message: 'Do you want to configure Stripe payments?',
    initialValue: true,
  });

  if (isCancel(enabled)) {
    process.exit(0);
  }

  if (!enabled) {
    return { enabled: false };
  }

  const stripeSecretKey = await text({
    message: 'Enter your Stripe secret key (sk_test_... or sk_live_...):',
    validate: async (input) => {
      if (!input || input.trim() === '') {
        return 'Stripe secret key is required';
      }
      const result = await validateStripeKey(input);
      return result.valid ? undefined : result.message || 'Invalid Stripe key';
    },
  });

  if (isCancel(stripeSecretKey)) {
    process.exit(0);
  }

  const stripePublishableKey = await text({
    message: 'Enter your Stripe publishable key (pk_test_... or pk_live_...):',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'Stripe publishable key is required';
      }
      if (!(input.startsWith('pk_test_') || input.startsWith('pk_live_'))) {
        return 'Stripe publishable key must start with pk_test_ or pk_live_';
      }
      return undefined;
    },
  });

  if (isCancel(stripePublishableKey)) {
    process.exit(0);
  }

  const stripeWebhookSecret = await text({
    message: 'Enter your Stripe webhook secret (whsec_..., optional - press Enter to skip):',
    defaultValue: '',
  });

  if (isCancel(stripeWebhookSecret)) {
    process.exit(0);
  }

  return {
    enabled: true,
    stripeSecretKey,
    stripePublishableKey,
    stripeWebhookSecret: stripeWebhookSecret || undefined,
  };
}
