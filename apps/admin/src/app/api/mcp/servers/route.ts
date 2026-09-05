/**
 * MCP Servers Registry  -  GET /api/mcp/servers
 *
 * Returns static metadata for the 7 built-in MCP servers.
 * This is the data source for the MCP UI tab in /admin/agents.
 *
 * Tool lists are static (no process spawning)  -  they reflect the
 * built-in MCP capabilities surfaced through the RevealUI MCP setup flow.
 */

import { getSession } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import type { McpServerInfo } from '@/lib/components/agents/mcp-server-card';
import { extractRequestContext } from '@/lib/utils/request-context';

export const runtime = 'nodejs';

const MCP_SERVERS: McpServerInfo[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    description:
      'Deploy projects, list deployments, manage environment variables, and inspect build logs on Vercel.',
    status: 'configured',
    packageName: 'vercel-mcp',
    envRequired: ['VERCEL_TOKEN'],
    tools: [
      {
        name: 'list_deployments',
        description: 'List recent deployments for a project',
        parameterCount: 2,
      },
      {
        name: 'get_deployment',
        description: 'Get details of a specific deployment',
        parameterCount: 1,
      },
      { name: 'redeploy', description: 'Trigger a redeployment', parameterCount: 2 },
      { name: 'list_projects', description: 'List all Vercel projects', parameterCount: 0 },
      {
        name: 'get_env_vars',
        description: 'List environment variables for a project',
        parameterCount: 2,
      },
      {
        name: 'upsert_env_var',
        description: 'Create or update an environment variable',
        parameterCount: 4,
      },
      {
        name: 'get_build_logs',
        description: 'Fetch build logs for a deployment',
        parameterCount: 2,
      },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description:
      'Manage customers, subscriptions, products, prices, and payment intents via the Stripe API.',
    status: 'configured',
    packageName: '@stripe/mcp',
    envRequired: ['STRIPE_SECRET_KEY'],
    tools: [
      {
        name: 'list_customers',
        description: 'List Stripe customers with optional filters',
        parameterCount: 3,
      },
      { name: 'create_customer', description: 'Create a new Stripe customer', parameterCount: 3 },
      { name: 'list_subscriptions', description: 'List active subscriptions', parameterCount: 2 },
      {
        name: 'cancel_subscription',
        description: 'Cancel a subscription immediately or at period end',
        parameterCount: 2,
      },
      { name: 'list_products', description: 'List products and their prices', parameterCount: 1 },
      {
        name: 'create_payment_intent',
        description: 'Create a PaymentIntent for a charge',
        parameterCount: 3,
      },
      { name: 'list_invoices', description: 'List invoices for a customer', parameterCount: 2 },
    ],
  },
  {
    id: 'neon',
    name: 'NeonDB',
    description: 'Manage NeonDB projects, branches, databases, and roles via neonctl CLI.',
    status: 'configured',
    packageName: 'neonctl',
    envRequired: ['NEON_API_KEY'],
    tools: [
      { name: 'list_projects', description: 'List NeonDB projects', parameterCount: 0 },
      {
        name: 'get_project',
        description: 'Get project details including connection info',
        parameterCount: 1,
      },
      { name: 'list_branches', description: 'List branches for a project', parameterCount: 1 },
      { name: 'create_branch', description: 'Create a new database branch', parameterCount: 3 },
      { name: 'delete_branch', description: 'Delete a branch', parameterCount: 2 },
      {
        name: 'connection_string',
        description: 'Get the connection string for a branch',
        parameterCount: 4,
      },
      { name: 'list_databases', description: 'List databases in a branch', parameterCount: 2 },
      { name: 'list_roles', description: 'List roles in a branch', parameterCount: 2 },
    ],
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Automate browser interactions, take screenshots, and run E2E tests.',
    status: 'configured',
    packageName: '@playwright/mcp',
    envRequired: [],
    tools: [
      { name: 'navigate', description: 'Navigate to a URL in the browser', parameterCount: 2 },
      {
        name: 'click',
        description: 'Click an element identified by a selector',
        parameterCount: 2,
      },
      { name: 'fill', description: 'Fill an input field with text', parameterCount: 3 },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current page',
        parameterCount: 1,
      },
      {
        name: 'evaluate',
        description: 'Evaluate JavaScript in the browser context',
        parameterCount: 2,
      },
      {
        name: 'wait_for_selector',
        description: 'Wait for an element to appear',
        parameterCount: 3,
      },
    ],
  },
  {
    id: 'memory',
    name: 'RevealUI Memory',
    description:
      'Multi-agent shared memory coordination. Publish facts, edit shared scratchpads, ' +
      'share memories, and trigger LLM reconciliation across concurrent agents.',
    status: 'configured',
    packageName: '@revealui/mcp',
    envRequired: ['REVEALUI_API_URL', 'REVEALUI_API_TOKEN'],
    tools: [
      {
        name: 'memory_publish_fact',
        description: 'Publish a discovery to the shared fact log',
        parameterCount: 4,
      },
      {
        name: 'memory_list_facts',
        description: 'List facts for a coordination session',
        parameterCount: 1,
      },
      {
        name: 'memory_create_scratchpad',
        description: 'Create a new shared Yjs scratchpad',
        parameterCount: 3,
      },
      {
        name: 'memory_patch_scratchpad',
        description: 'Apply a structured patch to a scratchpad',
        parameterCount: 5,
      },
      {
        name: 'memory_read_scratchpad',
        description: 'Read current scratchpad content as JSON',
        parameterCount: 1,
      },
      {
        name: 'memory_share',
        description: 'Share a memory with all agents in a session',
        parameterCount: 6,
      },
      {
        name: 'memory_list_shared',
        description: 'List shared and reconciled memories',
        parameterCount: 1,
      },
      {
        name: 'memory_reconcile',
        description: 'Trigger LLM reconciliation of shared facts',
        parameterCount: 2,
      },
    ],
  },
  {
    id: 'knowledge-graph',
    name: 'Knowledge Graph',
    description:
      'Durable fleet knowledge graph. Hybrid search, neighbors, paths, point-in-time facts, ' +
      'and additive episode ingest. Distinct from session shared_facts (memory_publish_fact). ' +
      'Tools also appear on governed /api/mcp; stdio launcher is revealui-mcp knowledge-graph.',
    status: 'configured',
    packageName: '@revealui/mcp',
    envRequired: [],
    tools: [
      {
        name: 'kg_search',
        description: 'Hybrid search over nodes and facts with provenance episode ids',
        parameterCount: 7,
      },
      {
        name: 'kg_get_node',
        description: 'Fetch a node and its current facts by natural key',
        parameterCount: 1,
      },
      {
        name: 'kg_neighbors',
        description: 'BFS neighbors of a node, current or as of a timestamp',
        parameterCount: 4,
      },
      {
        name: 'kg_path',
        description: 'Shortest path between two nodes',
        parameterCount: 4,
      },
      {
        name: 'kg_at_time',
        description: "A node's facts as of a point-in-time timestamp",
        parameterCount: 2,
      },
      {
        name: 'kg_context',
        description: 'Budgeted context assembly from an anchor node',
        parameterCount: 4,
      },
      {
        name: 'kg_add_episode',
        description: 'The only write tool: publish an additive episode plus candidate nodes/edges',
        parameterCount: 9,
      },
    ],
  },
  {
    id: 'next-devtools',
    name: 'Next.js DevTools',
    description: 'Introspect Next.js app routes, pages, API routes, and bundle analysis.',
    status: 'configured',
    packageName: 'next-devtools-mcp',
    envRequired: [],
    tools: [
      { name: 'list_routes', description: 'List all Next.js app router routes', parameterCount: 0 },
      { name: 'get_route', description: 'Get details of a specific route', parameterCount: 1 },
      { name: 'list_api_routes', description: 'List all API route handlers', parameterCount: 0 },
      { name: 'analyze_bundle', description: 'Analyze the Next.js bundle size', parameterCount: 1 },
    ],
  },
];

/** Derive runtime status by checking whether required env vars are set. */
function resolveStatus(server: McpServerInfo): McpServerInfo['status'] {
  if (server.envRequired.length === 0) return 'configured';
  return server.envRequired.every((key) => !!process.env[key]) ? 'configured' : 'unavailable';
}

export async function GET(request: NextRequest) {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const servers = MCP_SERVERS.map((s) => ({ ...s, status: resolveStatus(s) }));
  return NextResponse.json({ servers });
}
