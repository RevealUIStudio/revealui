/**
 * Payment configuration prompts
 */

import inquirer from 'inquirer';
import { validateStripeKey } from '../validators/credentials.js';

export interface PaymentConfig {
  enabled: boolean;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
}

export async function promptPaymentConfig(): Promise<PaymentConfig> {
  const { enabled } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Do you want to configure Stripe payments?',
      default: true,
    },
  ]);

  if (!enabled) {
    return { enabled: false };
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'stripeSecretKey',
      message: 'Enter your Stripe secret key (sk_test_... or sk_live_...):',
      validate: async (input: string) => {
        if (!input || input.trim() === '') {
          return 'Stripe secret key is required';
        }
        const result = await validateStripeKey(input);
        return result.valid ? true : result.message || 'Invalid Stripe key';
      },
    },
    {
      type: 'input',
      name: 'stripePublishableKey',
      message: 'Enter your Stripe publishable key (pk_test_... or pk_live_...):',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Stripe publishable key is required';
        }
        if (!(input.startsWith('pk_test_') || input.startsWith('pk_live_'))) {
          return 'Stripe publishable key must start with pk_test_ or pk_live_';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'stripeWebhookSecret',
      message: 'Enter your Stripe webhook secret (whsec_..., optional - press Enter to skip):',
      default: '',
    },
  ]);

  return {
    enabled: true,
    stripeSecretKey: answers.stripeSecretKey,
    stripePublishableKey: answers.stripePublishableKey,
    stripeWebhookSecret: answers.stripeWebhookSecret || undefined,
  };
}
