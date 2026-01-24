/**
 * @revealui/config - Stripe Configuration Module
 */

import type { EnvConfig } from "../schema";

export interface StripeConfig {
	secretKey: string;
	publishableKey: string;
	webhookSecret: string;
	proxy?: boolean;
}

export function getStripeConfig(env: EnvConfig): StripeConfig {
	return {
		secretKey: env.STRIPE_SECRET_KEY,
		publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
		webhookSecret: env.STRIPE_WEBHOOK_SECRET,
		proxy: env.STRIPE_PROXY === "1",
	};
}
