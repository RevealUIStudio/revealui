/**
 * Convert a Zod tool-parameter schema into JSON Schema that OpenAI-compatible
 * providers will accept.
 *
 * Zod v4 `z.string().email()` emits an ECMA-262 pattern with lookarounds.
 * JSON Schema 2020-12 `pattern` / OpenAI / Groq reject lookarounds, so the
 * entire tools[] payload 400s before the model runs (GAP-360 walk, create_user).
 *
 * `z.email()` already emits `{ format: "email" }`. This helper is the
 * conversion chokepoint so every future `.email()` / lookaround pattern is
 * rewritten here, not per-tool.
 */

import { z } from 'zod/v4';

const LOOKAROUND_PATTERN = /\(\?<?[=!]/;

export function toolParametersToJsonSchema(parameters: z.ZodType): Record<string, unknown> {
  return sanitizeProviderToolSchema(z.toJSONSchema(parameters));
}

export function sanitizeProviderToolSchema(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeNode(value, undefined);
  if (typeof sanitized !== 'object' || sanitized === null || Array.isArray(sanitized)) {
    return { type: 'object', properties: {} };
  }
  return sanitized as Record<string, unknown>;
}

function sanitizeNode(value: unknown, parentKey: string | undefined): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeNode(entry, parentKey));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const obj: Record<string, unknown> = { ...(value as Record<string, unknown>) };

  for (const nestKey of ['$defs', 'definitions', 'properties'] as const) {
    const nested = obj[nestKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const next: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(nested as Record<string, unknown>)) {
        next[key] = sanitizeNode(child, key);
      }
      obj[nestKey] = next;
    }
  }

  for (const nestKey of ['items', 'additionalProperties', 'not'] as const) {
    if (obj[nestKey] !== undefined) {
      obj[nestKey] = sanitizeNode(obj[nestKey], parentKey);
    }
  }

  for (const nestKey of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(obj[nestKey])) {
      obj[nestKey] = (obj[nestKey] as unknown[]).map((entry) => sanitizeNode(entry, parentKey));
    }
  }

  if (typeof obj.pattern === 'string' && LOOKAROUND_PATTERN.test(obj.pattern)) {
    const emailShaped =
      obj.format === 'email' ||
      parentKey === 'email' ||
      (typeof obj.description === 'string' && /email/i.test(obj.description));
    delete obj.pattern;
    if (emailShaped) {
      obj.format = 'email';
    }
  }

  return obj;
}
