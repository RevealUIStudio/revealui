/**
 * Cron route authentication helper.
 *
 * Vercel crons send the secret as: Authorization: Bearer <REVEALUI_CRON_SECRET>
 * Uses timing-safe comparison to prevent timing attacks.
 */
import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

export function verifyCronAuth(request: NextRequest): boolean {
  const secret = process.env.REVEALUI_CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice('Bearer '.length);
  if (token.length !== secret.length) return false;

  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}
