#!/usr/bin/env node

/**
 * RevealUI Email MCP Server
 *
 * Model Context Protocol server that exposes email sending tools.
 * Lets AI agents send notification emails, digests, alerts, and
 * templated messages on behalf of a RevealUI site.
 *
 * Provider: Gmail REST API (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)
 *
 * Environment:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  -  Google Workspace service account
 *   GOOGLE_PRIVATE_KEY            -  RSA private key (PKCS8, \n-escaped)
 *   EMAIL_FROM                    -  Sender address (default: noreply@revealui.com)
 *   EMAIL_REPLY_TO                -  Default reply-to (e.g. support@revealui.com)
 *
 * Tools:
 *   email_send           -  Send a single email (HTML or plain text)
 *   email_send_batch     -  Send up to 100 emails in one request
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
import { type EmailPayload, sendEmail, sendEmailBatch } from './_email-provider.js';

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
// Tool argument schemas (Zod 4)
// ---------------------------------------------------------------------------

export const EmailSendArgsSchema = z
  .object({
    to: z.union([z.string(), z.array(z.string())]),
    subject: z.string(),
    html: z.string().optional(),
    text: z.string().optional(),
    from: z.string().optional(),
    reply_to: z.string().optional(),
  })
  .strict();

const EmailItemSchema = z
  .object({
    to: z.string(),
    subject: z.string(),
    html: z.string().optional(),
    text: z.string().optional(),
    from: z.string().optional(),
  })
  .strict();

export const EmailSendBatchArgsSchema = z
  .object({
    emails: z.array(EmailItemSchema).max(100),
  })
  .strict();

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const DEFAULT_FROM = 'RevealUI <notifications@revealui.com>';

const server = new Server(
  { name: 'revealui-email', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

const TOOLS: Tool[] = [
  {
    name: 'email_send',
    description:
      'Send a single transactional email via the configured email provider ' +
      '(Gmail REST API). Provide either html or text (or both). Returns the message ID.',
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
      'Send up to 100 emails in a single request. ' +
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
                description: 'Sender address (defaults to EMAIL_FROM)',
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
  const startTime = Date.now();
  const toolName = request.params.name;

  const fromAddress =
    _credentialOverrides.EMAIL_FROM ??
    _credentialOverrides.REVEALUI_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    process.env.REVEALUI_FROM_EMAIL ??
    DEFAULT_FROM;

  try {
    let result: unknown;

    switch (toolName) {
      case 'email_send': {
        const parsed = validateToolArgs(EmailSendArgsSchema, request.params.arguments, toolName);
        if (!parsed.ok) return parsed.error;
        const { to, subject, html, text, from = fromAddress, reply_to } = parsed.value;

        if (!(html ?? text)) {
          return {
            content: [{ type: 'text', text: 'Error: Provide at least one of html or text' }],
            isError: true,
          };
        }

        const payload: EmailPayload = { from, to, subject };
        if (html) payload.html = html;
        if (text) payload.text = text;
        if (reply_to) payload.reply_to = reply_to;
        payload.tags = [{ name: 'source', value: 'revealui-mcp' }];

        result = await sendEmail(payload, _credentialOverrides);
        break;
      }

      case 'email_send_batch': {
        const parsed = validateToolArgs(
          EmailSendBatchArgsSchema,
          request.params.arguments,
          toolName,
        );
        if (!parsed.ok) return parsed.error;
        const { emails } = parsed.value;

        const payloads: EmailPayload[] = emails.map((e) => {
          const payload: EmailPayload = {
            from: e.from ?? fromAddress,
            to: e.to,
            subject: e.subject,
            tags: [{ name: 'source', value: 'revealui-mcp' }],
          };
          if (e.html) payload.html = e.html;
          if (e.text) payload.text = e.text;
          return payload;
        });

        result = await sendEmailBatch(payloads, _credentialOverrides);
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
              data: result,
              _meta: {
                durationMs: Date.now() - startTime,
                server: 'revealui-email',
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
  logger.info('revealui-email MCP server running (Gmail REST API)');
}

main().catch((err: unknown) => {
  logger.error('revealui-email server failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
