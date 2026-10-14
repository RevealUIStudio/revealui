/**
 * Kill switch for AI routes that reserve a task-quota slot.
 *
 * Mount this before requireTaskQuota. A disabled call returns 503 and
 * does not admit a monthly agent task.
 */

import { isAiDisabled } from '@revealui/core/ai-runtime-guards';
import type { Context, Next } from 'hono';

export async function rejectWhenAiDisabled(
  c: Context,
  next: Next,
  // biome-ignore lint/suspicious/noConfusingVoidType: Hono middleware must return Response | void
): Promise<Response | void> {
  if (!isAiDisabled()) return next();
  return c.json({ success: false, error: 'AI is temporarily disabled.', code: 'AI_DISABLED' }, 503);
}
