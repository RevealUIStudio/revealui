/**
 * Generate REST API reference markdown from OpenAPI spec.
 *
 * Usage:
 *   pnpm docs:generate:api
 *
 * Input:  examples/api/openapi.json  (update with: curl http://localhost:3004/openapi.json > examples/api/openapi.json)
 * Output: docs/api/rest-api/README.md
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');

const specPath = join(repoRoot, 'examples/api/openapi.json');
const outputPath = join(repoRoot, 'docs/api/rest-api/README.md');

interface OpenAPIParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: { type?: string; format?: string; default?: unknown };
}

interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  security?: Record<string, unknown>[];
  parameters?: OpenAPIParam[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses: Record<string, { description: string }>;
}

interface OpenAPITag {
  name: string;
  description?: string;
}

interface OpenAPISpec {
  info: { title: string; version: string; description?: string };
  tags?: OpenAPITag[];
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function badge(method: string): string {
  return `\`${method.toUpperCase()}\``;
}

function generateMarkdown(spec: OpenAPISpec): string {
  const lines: string[] = [];

  // Header
  lines.push(
    `# REST API Reference`,
    ``,
    `**Version:** ${spec.info.version}`,
    ``,
    `**Base URL (production):** \`https://api.revealui.com/api\``,
    ``,
    `**Interactive docs:** Start the API server (\`pnpm dev:api\`) and open [http://localhost:3004](http://localhost:3004) for full Swagger UI with request builder.`,
    ``,
    `> **Note:** This reference is generated from \`examples/api/openapi.json\`. To regenerate from the live API spec, run:`,
    `> \`\`\`bash`,
    `> curl http://localhost:3004/openapi.json > examples/api/openapi.json`,
    `> pnpm docs:generate:api`,
    `> \`\`\``,
    ``,
    `---`,
    ``,
  );

  // Authentication note
  lines.push(
    `## Authentication`,
    ``,
    `RevealUI uses **session-based authentication** (no JWTs). Sign in via \`POST /auth/sign-in\` to receive a \`revealui-session\` cookie. Include this cookie in all subsequent requests. Routes marked 🔒 require an active session.`,
    ``,
    `---`,
    ``,
  );

  // Group endpoints by tag
  const tagOrder = spec.tags?.map((t) => t.name) ?? [];
  const byTag = new Map<string, Array<{ method: string; path: string; op: OpenAPIOperation }>>();

  for (const tag of tagOrder) {
    byTag.set(tag, []);
  }

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = methods[method];
      if (!op) continue;
      const tag = op.tags?.[0] ?? 'Other';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)?.push({ method, path, op });
    }
  }

  // Table of contents
  lines.push(`## Endpoints`, ``);
  for (const [tagName, endpoints] of byTag.entries()) {
    if (endpoints.length === 0) continue;
    const anchor = tagName.toLowerCase().replace(/\s+/g, '-');
    lines.push(`- [${tagName}](#${anchor})`);
  }
  lines.push(``, `---`, ``);

  // Sections
  for (const [tagName, endpoints] of byTag.entries()) {
    if (endpoints.length === 0) continue;

    const tagMeta = spec.tags?.find((t) => t.name === tagName);
    lines.push(`## ${tagName}`, ``);
    if (tagMeta?.description) lines.push(tagMeta.description, ``);

    for (const { method, path, op } of endpoints) {
      const requiresAuth = op.security && op.security.length > 0;
      lines.push(`### ${badge(method)} \`${path}\`${requiresAuth ? ' 🔒' : ''}`, ``);

      if (op.summary) lines.push(`**${op.summary}**`, ``);
      if (op.description && op.description !== op.summary) {
        lines.push(op.description, ``);
      }

      // Path params
      const pathParams = op.parameters?.filter((p) => p.in === 'path') ?? [];
      if (pathParams.length > 0) {
        lines.push(`**Path parameters**`, ``);
        lines.push(`| Name | Type | Required | Description |`);
        lines.push(`|------|------|:--------:|-------------|`);
        for (const p of pathParams) {
          lines.push(
            `| \`${p.name}\` | \`${p.schema?.type ?? 'string'}\` | ${p.required ? '✓' : '—'} | ${p.description ?? ''} |`,
          );
        }
        lines.push(``);
      }

      // Query params
      const queryParams = op.parameters?.filter((p) => p.in === 'query') ?? [];
      if (queryParams.length > 0) {
        lines.push(`**Query parameters**`, ``);
        lines.push(`| Name | Type | Required | Default | Description |`);
        lines.push(`|------|------|:--------:|---------|-------------|`);
        for (const p of queryParams) {
          const def = p.schema?.default != null ? `\`${p.schema.default}\`` : ' - ';
          lines.push(
            `| \`${p.name}\` | \`${p.schema?.type ?? 'string'}\` | ${p.required ? '✓' : '—'} | ${def} | ${p.description ?? ''} |`,
          );
        }
        lines.push(``);
      }

      // Request body
      if (op.requestBody) {
        const jsonSchema = op.requestBody.content['application/json']?.schema as
          | Record<string, unknown>
          | undefined;
        if (jsonSchema) {
          lines.push(`**Request body** (JSON)`, ``);
          const required = (jsonSchema.required as string[]) ?? [];
          const props =
            (jsonSchema.properties as Record<
              string,
              { type?: string; format?: string; description?: string }
            >) ?? {};
          if (Object.keys(props).length > 0) {
            lines.push(`| Field | Type | Required | Description |`);
            lines.push(`|-------|------|:--------:|-------------|`);
            for (const [name, field] of Object.entries(props)) {
              const type = field.format ? `${field.type} (${field.format})` : (field.type ?? 'any');
              lines.push(
                `| \`${name}\` | \`${type}\` | ${required.includes(name) ? '✓' : '—'} | ${field.description ?? ''} |`,
              );
            }
          } else {
            lines.push('See API schema for request body shape.');
          }
          lines.push(``);
        }
      }

      // Responses
      lines.push(`**Responses**`, ``);
      for (const [status, resp] of Object.entries(op.responses)) {
        lines.push(`- \`${status}\` — ${resp.description}`);
      }
      lines.push(``, `---`, ``);
    }
  }

  return lines.join('\n');
}

const raw = readFileSync(specPath, 'utf-8');
const spec = JSON.parse(raw) as OpenAPISpec;

const markdown = generateMarkdown(spec);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, markdown);

console.log(`✓ Generated: ${outputPath}`);
console.log(`  ${Object.keys(spec.paths).length} endpoints across ${spec.tags?.length ?? 0} tags`);
