#!/usr/bin/env node

/**
 * RevealUI Stripe MCP Server
 *
 * Model Context Protocol server that exposes Stripe payment management tools
 * scoped to RevealUI's subscription model. Gives AI agents structured access
 * to customer, subscription, and payment intent data in RevealUI's Stripe account.
 *
 * Environment:
 *   STRIPE_SECRET_KEY  -  Stripe secret key (sk_live_... or sk_test_...)
 *
 * Tools:
 *   stripe_create_payment_intent   -  Create a one-time payment intent
 *   stripe_list_customers          -  List customers, with optional email filter
 *   stripe_get_customer            -  Fetch a customer and their active subscription
 *   stripe_list_subscriptions      -  List subscriptions (all or by customer/status)
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
import { z } from 'zod/v4';
import { validateToolArgs } from '../validate-tool-args.js';

// ---------------------------------------------------------------------------
// Credential overrides (set by Hypervisor before tool invocations)
// ---------------------------------------------------------------------------

let _credentialOverrides: Record<string, string> = {};

/**
 * Set credential overrides for this server.
 * Called by the Hypervisor with resolved tenant credentials.
 */
export function setCredentials(creds: Record<string, string>): void {
  _credentialOverrides = creds;
}

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
// Tool argument schemas (Zod 4)
// ---------------------------------------------------------------------------

const CreatePaymentIntentSchema = z
  .object({
    amount: z.number().int().positive(),
    currency: z.string().min(3).max(3).optional(),
    customer_id: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

const ListCustomersSchema = z
  .object({
    email: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const GetCustomerSchema = z
  .object({
    customer_id: z.string().min(1),
  })
  .strict();

const ListSubscriptionsSchema = z
  .object({
    customer_id: z.string().optional(),
    status: z
      .enum(['active', 'canceled', 'past_due', 'trialing', 'all', 'unpaid', 'incomplete'])
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

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
    inputSchema: z.toJSONSchema(CreatePaymentIntentSchema) as Tool['inputSchema'],
  },
  {
    name: 'stripe_list_customers',
    description: 'List Stripe customers in the RevealUI account. Optionally filter by email.',
    inputSchema: z.toJSONSchema(ListCustomersSchema) as Tool['inputSchema'],
  },
  {
    name: 'stripe_get_customer',
    description:
      'Fetch a Stripe customer by ID, including their active RevealUI subscription tier.',
    inputSchema: z.toJSONSchema(GetCustomerSchema) as Tool['inputSchema'],
  },
  {
    name: 'stripe_list_subscriptions',
    description: 'List Stripe subscriptions for RevealUI. Can filter by customer and/or status.',
    inputSchema: z.toJSONSchema(ListSubscriptionsSchema) as Tool['inputSchema'],
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const startTime = Date.now();
  const toolName = request.params.name;

  const secretKey = _credentialOverrides.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      content: [{ type: 'text', text: 'Error: STRIPE_SECRET_KEY is not set' }],
      isError: true,
    };
  }

  try {
    let data: unknown;

    switch (toolName) {
      case 'stripe_create_payment_intent': {
        const parsed = validateToolArgs(
          CreatePaymentIntentSchema,
          request.params.arguments,
          toolName,
        );
        if (!parsed.ok) return parsed.error;
        const { amount, currency = 'usd', customer_id, description } = parsed.value;
        const body: Record<string, string> = {
          amount: String(Math.round(amount)),
          currency,
        };
        if (customer_id) body.customer = customer_id;
        if (description) body.description = description;

        data = await stripePost('/payment_intents', secretKey, body);
        break;
      }

      case 'stripe_list_customers': {
        const parsed = validateToolArgs(ListCustomersSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error;
        const { email, limit = 20 } = parsed.value;
        const params: Record<string, string> = { limit: String(Math.min(limit, 100)) };
        if (email) params.email = email;

        data = await stripeGet('/customers', secretKey, params);
        break;
      }

      case 'stripe_get_customer': {
        const parsed = validateToolArgs(GetCustomerSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error;
        const { customer_id } = parsed.value;
        const [customer, subscriptions] = await Promise.all([
          stripeGet(`/customers/${customer_id}`, secretKey),
          stripeGet('/subscriptions', secretKey, {
            customer: customer_id,
            status: 'active',
            limit: '5',
            'expand[]': 'data.items.data.price.product',
          }),
        ]);
        data = { customer, subscriptions };
        break;
      }

      case 'stripe_list_subscriptions': {
        const parsed = validateToolArgs(
          ListSubscriptionsSchema,
          request.params.arguments,
          toolName,
        );
        if (!parsed.ok) return parsed.error;
        const { customer_id, status = 'active', limit = 20 } = parsed.value;
        const params: Record<string, string> = {
          limit: String(Math.min(limit, 100)),
          status,
        };
        if (customer_id) params.customer = customer_id;

        data = await stripeGet('/subscriptions', secretKey, params);
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown tool: ${toolName}` }],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              data,
              _meta: {
                durationMs: Date.now() - startTime,
                server: 'revealui-stripe',
                tool: toolName,
                timestamp: new Date().toISOString(),
              },
            },
            null,
            2,
          ),
        },
      ],
    };
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Stripe MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
