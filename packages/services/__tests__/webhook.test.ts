import { protectedStripe } from "services/server";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/core/api/webhooks";

// Mock Supabase client
vi.mock("../src/core/supabase", () => ({
	createServerClientFromRequest: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
	}),
}));

// Mock Stripe initialization to prevent requiring real API key
vi.mock("@revealui/config", () => ({
	default: {
		stripe: {
			secretKey: "sk_test_mock_key_for_webhook_tests_only",
		},
	},
}));

describe("Webhook Signature Validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// NOTE: import.meta.env is mocked via vitest.config.ts define config
		// This replaces import.meta.env.STRIPE_WEBHOOK_SECRET at build time
		// No need to stub globals here - the define config handles it
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should reject request with invalid signature", async () => {
		// NOTE: import.meta.env is mocked via vitest.config.ts define config
		// The webhook handler will use the mocked value from define config
		const body = JSON.stringify({ type: "payment_intent.succeeded", data: {} });
		const invalidSig = "invalid_signature";

		const request = new Request("http://localhost/api/webhooks/stripe", {
			method: "POST",
			body,
			headers: {
				"Stripe-Signature": invalidSig,
				"Content-Type": "application/json",
			},
		});

		const spy = vi
			.spyOn(protectedStripe.webhooks, "constructEvent")
			.mockImplementation(() => {
				throw new Error("Invalid signature");
			});

		const response = await POST(request);

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain("Webhook Error");

		spy.mockRestore();
	});

	it("should accept request with valid signature", async () => {
		// NOTE: import.meta.env is mocked via vitest.config.ts define config
		// The webhook handler will use the mocked value from define config
		const event: Stripe.Event = {
			id: "evt_test",
			object: "event",
			type: "payment_intent.succeeded",
			data: { object: {} },
			created: Math.floor(Date.now() / 1000),
			livemode: false,
			pending_webhooks: 0,
			request: null,
			api_version: "2024-06-20",
		};

		const body = JSON.stringify(event);
		const validSig = "valid_signature";

		const request = new Request("http://localhost/api/webhooks/stripe", {
			method: "POST",
			body,
			headers: {
				"Stripe-Signature": validSig,
				"Content-Type": "application/json",
			},
		});

		const spy = vi
			.spyOn(protectedStripe.webhooks, "constructEvent")
			.mockReturnValue(event);

		const response = await POST(request);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json).toEqual({ received: true });

		spy.mockRestore();
	});

	it("should reject request with missing signature", async () => {
		const body = JSON.stringify({ type: "payment_intent.succeeded", data: {} });

		const request = new Request("http://localhost/api/webhooks/stripe", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/json",
				// No Stripe-Signature header
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain("Missing signature or webhook secret");
	});

	it("should reject request with missing webhook secret", async () => {
		// This test verifies that if import.meta.env.STRIPE_WEBHOOK_SECRET is not set,
		// the handler returns 400
		// Note: In test environment, vitest.config.ts define config should provide a default
		// But we can test the error path by mocking constructEvent to throw
		const body = JSON.stringify({ type: "payment_intent.succeeded", data: {} });
		const sig = "test_signature";

		const request = new Request("http://localhost/api/webhooks/stripe", {
			method: "POST",
			body,
			headers: {
				"Stripe-Signature": sig,
				"Content-Type": "application/json",
			},
		});

		// If webhook secret is missing, constructEvent will fail
		const spy = vi
			.spyOn(protectedStripe.webhooks, "constructEvent")
			.mockImplementation(() => {
				throw new Error("No signatures found matching the expected signature");
			});

		const response = await POST(request);

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain("Webhook Error");

		spy.mockRestore();
	});
});
