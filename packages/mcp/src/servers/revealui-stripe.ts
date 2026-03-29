#!/usr/bin/env node

/**
 * RevealUI Stripe MCP Server
 *
 * Model Context Protocol server that exposes Stripe payment management tools
 * scoped to RevealUI's subscription model. Gives AI agents structured access
 * to customer, subscription, and payment intent data in RevealUI's Stripe account.
 *
 * Environment:
 *   STRIPE_SECRET_KEY — Stripe secret key (sk_live_... or sk_test_...)
 *
 * Tools:
 *   stripe_create_payment_intent  — Create a one-time payment intent
 *   stripe_list_customers         — List customers, with optional email filter
 *   stripe_get_customer           — Fetch a customer and their active subscription
 *   stripe_list_subscriptions     — List subscriptions (all or by customer/status)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@revealui/core/observability/logger';
import { checkMcpLicense } from '../index.js';

// ---------------------------------------------------------------------------
// Stripe REST helpers
// ---------------------------------------------------------------------------

const STRIPE_BASE = 'https://api.stripe.com/v1';

function stripeHeaders(secretKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': '2025-03-31.basil',
    'User-Agent': 'RevealUI-MCP/1.0',
  };
}

async function stripeGet(path: string, secretKey: string, params?: Record<string, string>) {
  const url = new URL(`${STRIPE_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: stripeHeaders(secretKey) });
  const body = await res.json();
  if (!res.ok)
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ?? `Stripe ${res.status}`,
    );
  return body;
}

async function stripePost(path: string, secretKey: string, data: Record<string, string>) {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    method: 'POST',
    headers: stripeHeaders(secretKey),
    body: new URLSearchParams(data).toString(),
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(
      (body as { error?: { message?: string } }).error?.message ?? `Stripe ${res.status}`,
    );
  return body;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'revealui-stripe', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  {
    name: 'stripe_create_payment_intent',
    description:
      'Create a Stripe PaymentIntent for a one-time charge in RevealUI. ' +
      'Amount is in the smallest currency unit (cents for USD).',
    inputSchema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in smallest currency unit (e.g. 2999 = $29.99)',
        },
        currency: {
          type: 'string',
          description: 'ISO 4217 currency code (default: usd)',
          default: 'usd',
        },
        customer_id: { type: 'string', description: 'Stripe customer ID to attach the payment to' },
        description: { type: 'string', description: 'Human-readable description of the charge' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'stripe_list_customers',
    description: 'List Stripe customers in the RevealUI account. Optionally filter by email.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Filter by exact email address' },
        limit: {
          type: 'number',
          description: 'Number of results (1-100, default: 20)',
          default: 20,
        },
      },
    },
  },
  {
    name: 'stripe_get_customer',
    description:
      'Fetch a Stripe customer by ID, including their active RevealUI subscription tier.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Stripe customer ID (cus_...)' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'stripe_list_subscriptions',
    description: 'List Stripe subscriptions for RevealUI. Can filter by customer and/or status.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Filter to a specific customer (cus_...)' },
        status: {
          type: 'string',
          description:
            'Filter by status: active, canceled, past_due, trialing, all (default: active)',
          default: 'active',
        },
        limit: {
          type: 'number',
          description: 'Number of results (1-100, default: 20)',
          default: 20,
        },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      content: [{ type: 'text', text: 'Error: STRIPE_SECRET_KEY is not set' }],
      isError: true,
    };
  }

  try {
    switch (request.params.name) {
      case 'stripe_create_payment_intent': {
        const {
          amount,
          currency = 'usd',
          customer_id,
          description,
        } = request.params.arguments as {
          amount: number;
          currency?: string;
          customer_id?: string;
          description?: string;
        };
        const data: Record<string, string> = {
          amount: String(Math.round(amount)),
          currency,
        };
        if (customer_id) data.customer = customer_id;
        if (description) data.description = description;

        const intent = await stripePost('/payment_intents', secretKey, data);
        return {
          content: [{ type: 'text', text: JSON.stringify(intent, null, 2) }],
        };
      }

      case 'stripe_list_customers': {
        const { email, limit = 20 } = request.params.arguments as {
          email?: string;
          limit?: number;
        };
        const params: Record<string, string> = { limit: String(Math.min(limit, 100)) };
        if (email) params.email = email;

        const result = await stripeGet('/customers', secretKey, params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'stripe_get_customer': {
        const { customer_id } = request.params.arguments as { customer_id: string };
        const [customer, subscriptions] = await Promise.all([
          stripeGet(`/customers/${customer_id}`, secretKey),
          stripeGet('/subscriptions', secretKey, {
            customer: customer_id,
            status: 'active',
            limit: '5',
            'expand[]': 'data.items.data.price.product',
          }),
        ]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ customer, subscriptions }, null, 2),
            },
          ],
        };
      }

      case 'stripe_list_subscriptions': {
        const {
          customer_id,
          status = 'active',
          limit = 20,
        } = request.params.arguments as {
          customer_id?: string;
          status?: string;
          limit?: number;
        };
        const params: Record<string, string> = {
          limit: String(Math.min(limit, 100)),
          status,
        };
        if (customer_id) params.customer = customer_id;

        const result = await stripeGet('/subscriptions', secretKey, params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown tool: ${request.params.name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
  }
});

async function main() {
  if (!(await checkMcpLicense())) {
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Stripe MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
