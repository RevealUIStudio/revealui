#!/usr/bin/env node

/**
 * RevealUI Memory MCP Server
 *
 * Model Context Protocol server that exposes multi-agent shared memory tools.
 * Gives any MCP-compatible agent (Claude Desktop, Cursor, Forge customers)
 * access to shared facts, Yjs scratchpads, and reconciled memories.
 *
 * Environment:
 *   REVEALUI_API_URL    - Admin API base URL (e.g. https://admin.revealui.com)
 *   REVEALUI_API_TOKEN  - Device token for authenticated API calls
 *
 * Tools:
 *   memory_publish_fact      - Publish a discovery to the shared fact log
 *   memory_list_facts        - List facts for a coordination session
 *   memory_create_scratchpad - Create a new shared Yjs scratchpad
 *   memory_patch_scratchpad  - Apply a structured patch to a scratchpad
 *   memory_read_scratchpad   - Read current scratchpad content
 *   memory_share             - Share a memory with all agents in a session
 *   memory_list_shared       - List shared/reconciled memories for a session
 *   memory_reconcile         - Trigger LLM reconciliation of shared facts
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
// Credential overrides (set by Hypervisor before tool invocations)
// ---------------------------------------------------------------------------

let _credentialOverrides: Record<string, string> = {};

export function setCredentials(creds: Record<string, string>): void {
  _credentialOverrides = creds;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getConfig(): { apiUrl: string; token: string } {
  const apiUrl = _credentialOverrides.REVEALUI_API_URL ?? process.env.REVEALUI_API_URL;
  const token = _credentialOverrides.REVEALUI_API_TOKEN ?? process.env.REVEALUI_API_TOKEN;
  if (!(apiUrl && token)) {
    throw new Error('REVEALUI_API_URL and REVEALUI_API_TOKEN must be set');
  }
  return { apiUrl, token };
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'RevealUI-MCP-Memory/0.1.0',
  };
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const { apiUrl, token } = getConfig();
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `API error ${res.status}`);
  }
  return data;
}

async function apiGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const { apiUrl, token } = getConfig();
  const url = new URL(`${apiUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: authHeaders(token) });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `API error ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'revealui-memory', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  // Layer 1: Shared Fact Log
  {
    name: 'memory_publish_fact',
    description:
      'Publish a discovery to the shared fact log. All agents in the same ' +
      'coordination session see it in real-time via ElectricSQL.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Coordination session ID' },
        agent_id: { type: 'string', description: 'Agent publishing this fact' },
        content: { type: 'string', description: 'The fact content' },
        fact_type: {
          type: 'string',
          description: 'Type: discovery, bug, decision, warning, question, answer',
          enum: ['discovery', 'bug', 'decision', 'warning', 'question', 'answer'],
        },
        confidence: { type: 'number', description: 'Confidence 0-1 (default: 1.0)' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for grouping and filtering',
        },
        source_ref: {
          type: 'object',
          description: 'Source reference (file path, line number, etc.)',
        },
      },
      required: ['session_id', 'agent_id', 'content', 'fact_type'],
    },
  },
  {
    name: 'memory_list_facts',
    description: 'List shared facts for a coordination session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Coordination session ID' },
      },
      required: ['session_id'],
    },
  },

  // Layer 2: Yjs Scratchpad
  {
    name: 'memory_create_scratchpad',
    description:
      'Create a new shared Yjs scratchpad document. Use set_key patch type ' +
      'to initialize with a title.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'Unique document ID' },
        agent_id: { type: 'string', description: 'Agent creating the scratchpad' },
        title: { type: 'string', description: 'Initial title for the scratchpad' },
      },
      required: ['document_id', 'agent_id'],
    },
  },
  {
    name: 'memory_patch_scratchpad',
    description:
      'Apply a structured patch to a shared Yjs scratchpad. Patches are ' +
      'applied server-side and synced to all subscribers via Electric.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'Scratchpad document ID' },
        agent_id: { type: 'string', description: 'Agent submitting the patch' },
        patch_type: {
          type: 'string',
          description: 'Type of edit',
          enum: ['append_section', 'append_item', 'replace_section', 'set_key'],
        },
        path: { type: 'string', description: 'Section path (e.g. "findings" or "plan.phase1")' },
        content: { type: 'string', description: 'Content to insert or replace' },
      },
      required: ['document_id', 'agent_id', 'patch_type', 'path', 'content'],
    },
  },
  {
    name: 'memory_read_scratchpad',
    description: 'Read the current content of a shared Yjs scratchpad as JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'Scratchpad document ID' },
      },
      required: ['document_id'],
    },
  },

  // Layer 3: Shared Memory + Reconciliation
  {
    name: 'memory_share',
    description:
      'Share a memory with all agents in a coordination session. Creates a ' +
      'shared agent_memories entry synced via Electric.',
    inputSchema: {
      type: 'object',
      properties: {
        session_scope: { type: 'string', description: 'Coordination session scope' },
        agent_id: { type: 'string', description: 'Agent sharing this memory' },
        site_id: { type: 'string', description: 'Site ID for ownership' },
        content: { type: 'string', description: 'Memory content' },
        type: {
          type: 'string',
          description: 'Memory type',
          enum: [
            'fact',
            'preference',
            'decision',
            'feedback',
            'example',
            'correction',
            'skill',
            'warning',
          ],
        },
        source: { type: 'object', description: 'Source metadata' },
      },
      required: ['session_scope', 'agent_id', 'site_id', 'content', 'type', 'source'],
    },
  },
  {
    name: 'memory_list_shared',
    description: 'List shared and reconciled memories for a coordination session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_scope: { type: 'string', description: 'Coordination session scope' },
      },
      required: ['session_scope'],
    },
  },
  {
    name: 'memory_reconcile',
    description:
      'Trigger reconciliation of shared facts. Deduplicates, resolves ' +
      'contradictions, and produces canonical reconciled memories.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Coordination session ID' },
        site_id: { type: 'string', description: 'Site ID for reconciled memories' },
      },
      required: ['session_id', 'site_id'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const startTime = Date.now();
  const toolName = request.params.name;

  try {
    // Validate credentials early
    getConfig();
  } catch {
    return {
      content: [
        { type: 'text', text: 'Error: REVEALUI_API_URL and REVEALUI_API_TOKEN must be set' },
      ],
      isError: true,
    };
  }

  try {
    let data: unknown;

    switch (toolName) {
      // Layer 1
      case 'memory_publish_fact': {
        const args = request.params.arguments as {
          session_id: string;
          agent_id: string;
          content: string;
          fact_type: string;
          confidence?: number;
          tags?: string[];
          source_ref?: Record<string, unknown>;
        };
        data = await apiPost('/api/sync/shared-facts', args);
        break;
      }

      case 'memory_list_facts': {
        const { session_id } = request.params.arguments as { session_id: string };
        data = await apiGet('/api/shapes/shared-facts', { session_id });
        break;
      }

      // Layer 2
      case 'memory_create_scratchpad': {
        const { document_id, agent_id, title } = request.params.arguments as {
          document_id: string;
          agent_id: string;
          title?: string;
        };
        data = await apiPost('/api/sync/yjs-document-patches', {
          document_id,
          agent_id,
          patch_type: 'set_key',
          path: 'title',
          content: title ?? 'Shared Scratchpad',
        });
        break;
      }

      case 'memory_patch_scratchpad': {
        const args = request.params.arguments as {
          document_id: string;
          agent_id: string;
          patch_type: string;
          path: string;
          content: string;
        };
        data = await apiPost('/api/sync/yjs-document-patches', args);
        break;
      }

      case 'memory_read_scratchpad': {
        const { document_id } = request.params.arguments as { document_id: string };
        data = await apiGet('/api/shapes/yjs-documents', { document_id });
        break;
      }

      // Layer 3
      case 'memory_share': {
        const args = request.params.arguments as {
          session_scope: string;
          agent_id: string;
          site_id: string;
          content: string;
          type: string;
          source: Record<string, unknown>;
        };
        data = await apiPost('/api/sync/shared-memories', args);
        break;
      }

      case 'memory_list_shared': {
        const { session_scope } = request.params.arguments as { session_scope: string };
        data = await apiGet('/api/shapes/shared-memories', { session_scope });
        break;
      }

      case 'memory_reconcile': {
        const args = request.params.arguments as {
          session_id: string;
          site_id: string;
        };
        data = await apiPost('/api/sync/reconcile', args);
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
                server: 'revealui-memory',
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
  if (!(await checkMcpLicense())) {
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Memory MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
