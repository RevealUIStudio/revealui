/**
 * Action middleware: require dogfood session for protected action ids (2.3.1).
 */
import type { ActionMiddleware } from '@revealui/router/core';
import { logger } from '@revealui/utils/logger';
import { getSession } from './session.ts';

/** RSDW / plugin-rsc action module ids that require a signed session. */
const PROTECTED_ACTION_ID_MARKERS = ['secretPing', 'protected-ping'] as const;

function isProtectedActionId(actionId: string | null | undefined): boolean {
  if (!actionId) return false;
  return PROTECTED_ACTION_ID_MARKERS.some((m) => actionId.includes(m));
}

/**
 * Fail closed (403) when a protected action runs without a valid session cookie.
 * Public actions (e.g. submitMessage) and progressive forms stay open unless marked.
 */
export const requireSessionForProtectedActions: ActionMiddleware = async (ctx) => {
  if (ctx.formAction) {
    // Progressive public forms stay open; protect only JS actions by id for dogfood.
    return true;
  }
  if (!isProtectedActionId(ctx.actionId)) {
    return true;
  }
  const session = await getSession();
  if (!session) {
    logger.warn('rsc-poc: protected action blocked — no session', {
      actionId: ctx.actionId ?? undefined,
      pathname: ctx.pathname,
    });
    return false;
  }
  logger.info('rsc-poc: protected action authorized', {
    sub: session.sub,
    actionId: ctx.actionId ?? undefined,
  });
  return true;
};
