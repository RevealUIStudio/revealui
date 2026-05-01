/**
 * RevealCoin (RVUI) public read endpoints.
 *
 * Public, unauthenticated read access for the RVUI dashboard at
 * `revealcoin.revealui.com`. All on-chain queries go through
 * `@revealui/services/revealcoin`, which provides circuit breaker
 * + retry + timeout protection on top of the Solana RPC.
 */

import { RVUI_ALLOCATIONS } from '@revealui/contracts';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { getRvuiBalance, getRvuiSupply } from '@revealui/services/revealcoin';

const app = new OpenAPIHono();

// ---------------------------------------------------------------------------
// GET /health  -  liveness check, no Solana RPC call
// ---------------------------------------------------------------------------

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['coin'],
  summary: 'RevealCoin liveness check',
  description:
    'Instant response with no Solana RPC call. Used by uptime monitors and the dashboard to confirm the coin endpoints are reachable.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            service: z.string(),
            timestamp: z.string(),
          }),
        },
      },
      description: 'Service alive',
    },
  },
});

app.openapi(healthRoute, (c) =>
  c.json({
    status: 'healthy',
    service: 'revealcoin',
    timestamp: new Date().toISOString(),
  }),
);

// ---------------------------------------------------------------------------
// GET /supply  -  current total RVUI token supply
// ---------------------------------------------------------------------------

const supplyRoute = createRoute({
  method: 'get',
  path: '/supply',
  tags: ['coin'],
  summary: 'RVUI total token supply',
  description:
    'Queries the Token-2022 mint via Solana JSON-RPC and returns the current total supply. Reflects mints minus burns.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            totalSupply: z.string(),
            decimals: z.number(),
            raw: z.string(),
          }),
        },
      },
      description: 'Current RVUI supply',
    },
    502: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Solana RPC failure or circuit breaker open',
    },
  },
});

app.openapi(supplyRoute, async (c) => {
  try {
    const supply = await getRvuiSupply();
    return c.json(
      {
        totalSupply: supply.uiAmountString,
        decimals: supply.decimals,
        raw: supply.raw.toString(),
      },
      200,
    );
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch supply' },
      502,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /allocations  -  per-allocation wallet balances
// ---------------------------------------------------------------------------

const allocationsRoute = createRoute({
  method: 'get',
  path: '/allocations',
  tags: ['coin'],
  summary: 'RVUI allocation balances',
  description:
    'Returns the on-chain RVUI balance for each canonical allocation wallet (Ecosystem, Treasury, Team, etc.) alongside its declared total amount and vesting description.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            allocations: z.array(
              z.object({
                name: z.string(),
                percentage: z.number(),
                totalAmount: z.number(),
                wallet: z.string(),
                balance: z.number(),
                vestingDescription: z.string(),
              }),
            ),
          }),
        },
      },
      description: 'Allocation balances',
    },
    502: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Solana RPC failure or circuit breaker open',
    },
  },
});

app.openapi(allocationsRoute, async (c) => {
  try {
    const balances = await Promise.all(
      RVUI_ALLOCATIONS.map(async (alloc) => {
        const balance = await getRvuiBalance(alloc.wallet);
        const totalHuman = Number(alloc.amount / 1_000_000n);
        return {
          name: alloc.name,
          percentage: alloc.percentage,
          totalAmount: totalHuman,
          wallet: alloc.wallet,
          balance: balance.uiAmount,
          vestingDescription: alloc.vestingDescription,
        };
      }),
    );
    return c.json({ allocations: balances }, 200);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch allocations' },
      502,
    );
  }
});

export default app;
