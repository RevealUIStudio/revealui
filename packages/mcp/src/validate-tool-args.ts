import type { z } from 'zod/v4';

export interface McpToolError {
  content: [{ type: 'text'; text: string }];
  isError: true;
}

export function validateToolArgs<T>(
  schema: z.ZodType<T>,
  args: unknown,
  toolName: string,
): { ok: true; value: T } | { ok: false; error: McpToolError } {
  const result = schema.safeParse(args);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const issues = result.error.issues
    .map((i) => `${i.path.length > 0 ? `${i.path.join('.')}: ` : ''}${i.message}`)
    .join('; ');
  return {
    ok: false,
    error: {
      content: [{ type: 'text', text: `Invalid arguments for tool "${toolName}": ${issues}` }],
      isError: true,
    },
  };
}
