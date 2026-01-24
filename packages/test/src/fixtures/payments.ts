/**
 * Payment test fixtures
 *
 * Provides test data for payment-related tests
 */

import { createTestId } from "../utils/test-helpers";

export interface TestPayment {
	id: string;
	amount: number;
	currency: string;
	customerId: string;
	status: "pending" | "succeeded" | "failed" | "canceled";
	paymentIntentId?: string;
	checkoutSessionId?: string;
}

/**
 * Create a test payment
 */
export function createTestPayment(
	overrides?: Partial<TestPayment>,
): TestPayment {
	const testId = createTestId("payment");

	return {
		id: overrides?.id || `payment_${testId}`,
		amount: overrides?.amount || 1000, // $10.00 in cents
		currency: overrides?.currency || "usd",
		customerId: overrides?.customerId || `customer_${testId}`,
		status: overrides?.status || "pending",
		paymentIntentId: overrides?.paymentIntentId || `pi_${testId}`,
		checkoutSessionId: overrides?.checkoutSessionId || `cs_${testId}`,
		...overrides,
	};
}

/**
 * Create a successful payment
 */
export function createSuccessfulPayment(
	overrides?: Partial<TestPayment>,
): TestPayment {
	return createTestPayment({
		status: "succeeded",
		...overrides,
	});
}

/**
 * Create a failed payment
 */
export function createFailedPayment(
	overrides?: Partial<TestPayment>,
): TestPayment {
	return createTestPayment({
		status: "failed",
		...overrides,
	});
}

/**
 * Default test payments for common scenarios
 */
export const defaultTestPayments = {
	small: createTestPayment({ amount: 500, status: "succeeded" }), // $5.00
	medium: createTestPayment({ amount: 2000, status: "succeeded" }), // $20.00
	large: createTestPayment({ amount: 5000, status: "succeeded" }), // $50.00
	pending: createTestPayment({ amount: 1000, status: "pending" }),
	failed: createTestPayment({ amount: 1000, status: "failed" }),
};
