#!/usr/bin/env node

/**
 * RevealUI Email MCP Server
 *
 * Model Context Protocol server that exposes email sending tools via Resend,
 * RevealUI's transactional email provider. Lets AI agents send notification
 * emails, digests, alerts, and templated messages on behalf of a RevealUI site.
 *
 * Environment:
 *   RESEND_API_KEY       — Resend API key (re_...)
 *   REVEALUI_FROM_EMAIL  — Default sender address (default: notifications@revealui.com)
 *
 * Tools:
 *   email_send          — Send a single email (HTML or plain text)
 *   email_send_batch    — Send up to 100 emails in one API call
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
// Resend REST helpers
// ---------------------------------------------------------------------------

const RESEND_BASE = 'https://api.resend.com';
const DEFAULT_FROM = 'RevealUI <notifications@revealui.com>';

interface ResendPayload {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  tags?: Array<{ name: string; value: string }>;
}

async function resendPost(apiKey: string, path: string, body: unknown) {
  const res = await fetch(`${RESEND_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'RevealUI-MCP/1.0',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { message?: string; name?: string }).message ??
        (data as { name?: string }).name ??
        `Resend ${res.status}`,
    );
  }
  return data;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'revealui-email', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  {
    name: 'email_send',
    description:
      "Send a single transactional email via RevealUI's Resend account. " +
      'Provide either html or text (or both). Returns the Resend message ID.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          oneOf: [
            { type: 'string', description: 'Single recipient email' },
            { type: 'array', items: { type: 'string' }, description: 'Multiple recipients' },
          ],
          description: 'Recipient email address(es)',
        },
        subject: { type: 'string', description: 'Email subject line' },
        html: { type: 'string', description: 'HTML body of the email' },
        text: { type: 'string', description: 'Plain-text fallback body' },
        from: {
          type: 'string',
          description: `Sender address (default: ${DEFAULT_FROM})`,
        },
        reply_to: { type: 'string', description: 'Reply-to address' },
      },
      required: ['to', 'subject'],
    },
  },
  {
    name: 'email_send_batch',
    description:
      'Send up to 100 emails in a single Resend batch request. ' +
      'Each email in the batch can have its own to/subject/html/text.',
    inputSchema: {
      type: 'object',
      properties: {
        emails: {
          type: 'array',
          description: 'Array of email objects to send',
          items: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Subject line' },
              html: { type: 'string', description: 'HTML body' },
              text: { type: 'string', description: 'Plain text body' },
              from: {
                type: 'string',
                description: 'Sender address (defaults to REVEALUI_FROM_EMAIL)',
              },
            },
            required: ['to', 'subject'],
          },
          maxItems: 100,
        },
      },
      required: ['emails'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      content: [{ type: 'text', text: 'Error: RESEND_API_KEY is not set' }],
      isError: true,
    };
  }

  const fromAddress = process.env.REVEALUI_FROM_EMAIL ?? DEFAULT_FROM;

  try {
    switch (request.params.name) {
      case 'email_send': {
        const {
          to,
          subject,
          html,
          text,
          from = fromAddress,
          reply_to,
        } = request.params.arguments as {
          to: string | string[];
          subject: string;
          html?: string;
          text?: string;
          from?: string;
          reply_to?: string;
        };

        if (!(html ?? text)) {
          return {
            content: [{ type: 'text', text: 'Error: Provide at least one of html or text' }],
            isError: true,
          };
        }

        const payload: ResendPayload = { from, to, subject };
        if (html) payload.html = html;
        if (text) payload.text = text;
        if (reply_to) payload.reply_to = reply_to;
        // Tag all RevealUI MCP emails for filtering in Resend dashboard
        payload.tags = [{ name: 'source', value: 'revealui-mcp' }];

        const result = await resendPost(apiKey, '/emails', payload);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'email_send_batch': {
        const { emails } = request.params.arguments as {
          emails: Array<{
            to: string;
            subject: string;
            html?: string;
            text?: string;
            from?: string;
          }>;
        };

        if (emails.length > 100) {
          return {
            content: [{ type: 'text', text: 'Error: Batch size cannot exceed 100 emails' }],
            isError: true,
          };
        }

        const batch = emails.map((e) => {
          const payload: ResendPayload = {
            from: e.from ?? fromAddress,
            to: e.to,
            subject: e.subject,
            tags: [{ name: 'source', value: 'revealui-mcp' }],
          };
          if (e.html) payload.html = e.html;
          if (e.text) payload.text = e.text;
          return payload;
        });

        const result = await resendPost(apiKey, '/emails/batch', batch);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
  logger.error('RevealUI Email MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
