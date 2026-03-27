/**
 * Lightweight email sender for the API service.
 *
 * Uses Resend API when RESEND_API_KEY is configured.
 * Falls back to logging in development.
 */

import { logger } from '@revealui/core/observability/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function sanitizeEmailHeader(value: string): string {
  // Strip CR and LF to prevent header injection via to/subject fields
  return value.replace(/[\r\n]/g, '');
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM;
  if (!fromEmail && process.env.NODE_ENV !== 'development') {
    logger.warn('RESEND_FROM_EMAIL is not set — emails will use noreply@revealui.com as sender');
  }
  const resolvedFrom = fromEmail ?? 'noreply@revealui.com';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Mock email sent (no RESEND_API_KEY)', {
        to: options.to,
        subject: options.subject,
      });
      return;
    }
    throw new Error('RESEND_API_KEY is not configured — email delivery is required in production');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      // biome-ignore lint/style/useNamingConvention: Authorization is a standard HTTP header name
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resolvedFrom,
      to: sanitizeEmailHeader(options.to),
      subject: sanitizeEmailHeader(options.subject),
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}
