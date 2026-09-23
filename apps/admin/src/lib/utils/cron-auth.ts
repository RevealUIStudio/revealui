/**
 * Cron route authentication helper.
 *
 * Vercel crons send the secret as: Authorization: Bearer <REVEALUI_CRON_SECRET>
 * During a rotation window, REVEALUI_CRON_SECRET_PREVIOUS is also accepted.
 * Uses timing-safe comparison to prevent timing attacks.
 */
import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

const BEARER_PREFIX = 'Bearer ';

function timingSafeMatch(token: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const trimmed = secret.trim();
  if (!trimmed) return false;
  try {
    const tokenBytes = Buffer.from(token);
    const secretBytes = Buffer.from(trimmed);
    return (
      tokenBytes.length === secretBytes.length && crypto.timingSafeEqual(tokenBytes, secretBytes)
    );
  } catch {
    return false;
  }
}

export function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith(BEARER_PREFIX)) return false;

  const token = authHeader.slice(BEARER_PREFIX.length);
  if (!token) return false;

  return (
    timingSafeMatch(token, process.env.REVEALUI_CRON_SECRET) ||
    timingSafeMatch(token, process.env.REVEALUI_CRON_SECRET_PREVIOUS)
  );
}
