/**
 * Email templates for Stripe webhook lifecycle events.
 *
 * Extracted from webhooks.ts to reduce file size and separate
 * concerns (email content vs. webhook business logic).
 */

import { logger } from '@revealui/core/observability/logger';
import { sendEmail } from './email.js';

// =============================================================================
// Shared helpers
// =============================================================================

function tierLabel(tier: string): string {
  if (tier === 'enterprise') return 'Enterprise';
  if (tier === 'max') return 'Max';
  return 'Pro';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cmsUrl(): string {
  return process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com';
}

function billingUrl(): string {
  return `${cmsUrl()}/account/billing`;
}

function supportEmail(): string {
  return process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com';
}

function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    ${body}
  </body>
</html>`;
}

function ctaButton(href: string, label: string, color = '#2563eb'): string {
  return `<p style="text-align: center; margin: 30px 0;">
  <a href="${href}" style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    ${label}
  </a>
</p>`;
}

function supportFooter(prefix = 'If you have questions'): string {
  return `<p style="color: #666; font-size: 14px;">${prefix}, contact ${supportEmail()}.</p>`;
}

// =============================================================================
// Email senders
// =============================================================================

export async function sendLicenseActivatedEmail(to: string, tier: string): Promise<void> {
  const label = tierLabel(tier);
  const featureList =
    tier === 'enterprise'
      ? ' multi-tenant architecture, white-label branding, SSO, and'
      : tier === 'max'
        ? ' AI memory, BYOK server-side, multi-provider AI, audit log, and'
        : '';

  await sendEmail({
    to,
    subject: `Your RevealUI ${label} license is active`,
    html: emailShell(
      'License Activated',
      `<h1 style="color: #2563eb;">Your License is Active</h1>
<p>Your RevealUI <strong>${label}</strong> license has been activated.</p>
<p>You now have access to all ${label} features including${featureList} AI agents, advanced sync, and built-in payments.</p>
${ctaButton(`${cmsUrl()}/admin`, 'Go to Dashboard')}
${supportFooter('If you have questions, reply to this email or contact')}`,
    ),
    text: `Your RevealUI ${label} license is now active. Go to your dashboard to explore your new features.`,
  });
}

export async function sendPaymentFailedEmail(to: string): Promise<void> {
  const portal = billingUrl();
  await sendEmail({
    to,
    subject: 'Action required: RevealUI payment failed',
    html: emailShell(
      'Payment Failed',
      `<h1 style="color: #dc2626;">Payment Failed</h1>
<p>We were unable to process your RevealUI subscription payment. Your Pro features may be restricted until payment is resolved.</p>
<p>Please update your payment method to continue using Pro features:</p>
${ctaButton(portal, 'Update Payment Method')}
${supportFooter('If you believe this is an error, contact')}`,
    ),
    text: `Your RevealUI subscription payment failed. Please update your payment method at ${portal} to continue using Pro features.`,
  });
}

export async function sendTrialEndingEmail(to: string, trialEnd: number | null): Promise<void> {
  const endDate = trialEnd
    ? new Date(trialEnd * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'soon';
  const portal = billingUrl();
  await sendEmail({
    to,
    subject: 'Your RevealUI Pro trial ends soon',
    html: emailShell(
      'Trial Ending',
      `<h1 style="color: #2563eb;">Your Trial Ends ${endDate}</h1>
<p>Your RevealUI Pro free trial is ending ${endDate}. After the trial, your subscription will automatically continue at $49/month.</p>
<p>If you'd like to continue with Pro features, no action is needed — your subscription will start automatically.</p>
<p>If you'd like to cancel or change your plan, you can do so from your billing page:</p>
${ctaButton(portal, 'Manage Subscription')}
${supportFooter('Questions? Contact')}`,
    ),
    text: `Your RevealUI Pro trial ends ${endDate}. Your subscription will automatically continue at $49/month. Manage your subscription at ${portal}.`,
  });
}

export async function sendPaymentRecoveredEmail(to: string): Promise<void> {
  const portal = billingUrl();
  await sendEmail({
    to,
    subject: 'Your RevealUI access has been restored',
    html: emailShell(
      'Access Restored',
      `<h1 style="color: #16a34a;">Payment Received — Access Restored</h1>
<p>Your RevealUI subscription payment was successfully processed. Your Pro access has been fully restored.</p>
${ctaButton(portal, 'Go to Billing')}
${supportFooter()}`,
    ),
    text: `Your RevealUI payment was received and your access has been restored. Manage your subscription at ${portal}.`,
  });
}

export async function sendPerpetualLicenseActivatedEmail(
  to: string,
  tier: string,
  supportExpiresAt: Date,
): Promise<void> {
  const label = tierLabel(tier);
  const supportExpiry = supportExpiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const portal = billingUrl();
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} Perpetual License is ready`,
    html: emailShell(
      'Perpetual License Activated',
      `<h1 style="color: #2563eb;">Your Perpetual License is Active</h1>
<p>Thank you for purchasing RevealUI <strong>${label} Perpetual</strong>. Your license never expires.</p>
<p>Your purchase includes <strong>1 year of support</strong> (until ${supportExpiry}). You'll receive a reminder 30 days before it lapses.</p>
${ctaButton(portal, 'View Your License')}
${supportFooter('Questions? Reply to this email or contact')}`,
    ),
    text: `Your RevealUI ${label} Perpetual License is now active. The license never expires. Your 1-year support contract runs until ${supportExpiry}. View your license at ${portal}.`,
  });
}

export async function sendDisputeLostEmail(to: string): Promise<void> {
  const portal = billingUrl();
  const support = supportEmail();
  await sendEmail({
    to,
    subject: 'Your RevealUI license has been suspended',
    html: emailShell(
      'License Suspended',
      `<h1 style="color: #dc2626;">License Suspended</h1>
<p>Your RevealUI Pro/Enterprise license has been suspended following a chargeback decision on a recent payment.</p>
<p>To restore access, please contact us at <a href="mailto:${support}">${support}</a> to resolve the dispute and arrange a new payment.</p>
${ctaButton(portal, 'Manage Billing')}
<p style="color: #666; font-size: 14px;">If you believe this is an error, please reply to this email immediately.</p>`,
    ),
    text: `Your RevealUI Pro/Enterprise license has been suspended following a chargeback decision. Contact ${support} to resolve this. Manage your billing at ${portal}.`,
  });
}

export async function sendTierFallbackAlert(
  email: string,
  context: { tier: string | null; metadata: Record<string, string> | null },
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '[CRITICAL] RevealUI: Stripe tier metadata missing — defaulted to pro',
    html: emailShell(
      'Tier Metadata Alert',
      `<h1 style="color: #dc2626;">Stripe Tier Metadata Missing</h1>
<p>A webhook event was processed with missing or unrecognized tier metadata.</p>
<p><strong>Received tier:</strong> ${escapeHtml(context.tier ?? '(none)')}</p>
<p><strong>Metadata:</strong> <code>${escapeHtml(JSON.stringify(context.metadata))}</code></p>
<p>The customer was assigned <strong>pro</strong> tier as a safety default. Check Stripe product metadata immediately.</p>`,
    ),
    text: `A webhook event was processed with missing or unrecognized tier metadata.\n\nReceived tier: ${context.tier}\nMetadata: ${JSON.stringify(context.metadata)}\n\nThe customer was assigned 'pro' tier as a safety default. Check Stripe product metadata immediately.`,
  });
}

export async function sendWebhookFailureAlert(
  email: string,
  context: {
    eventId: string;
    eventType: string;
    error: string;
    customerId?: string;
  },
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `[CRITICAL] RevealUI: Webhook handler crashed — ${context.eventType}`,
    html: emailShell(
      'Webhook Handler Failure',
      `<h1 style="color: #dc2626;">Webhook Handler Crashed</h1>
<p>A Stripe webhook event failed to process. Stripe will retry for up to 72 hours.</p>
<p><strong>Event ID:</strong> <code>${escapeHtml(context.eventId)}</code></p>
<p><strong>Event Type:</strong> <code>${escapeHtml(context.eventType)}</code></p>
<p><strong>Error:</strong> ${escapeHtml(context.error)}</p>
${context.customerId ? `<p><strong>Customer ID:</strong> <code>${escapeHtml(context.customerId)}</code></p>` : ''}
<p style="color: #dc2626; font-weight: bold;">If this is a checkout.session.completed event, a customer may have paid but not received their license. Check Stripe dashboard and manually generate a license if needed.</p>
<p>Check API logs for full stack trace.</p>`,
    ),
    text: `Webhook handler crashed.\n\nEvent ID: ${context.eventId}\nEvent Type: ${context.eventType}\nError: ${context.error}\n${context.customerId ? `Customer ID: ${context.customerId}\n` : ''}\nStripe will retry for 72 hours. Check API logs.`,
  });
}

// =============================================================================
// GitHub team provisioning — side-effect triggered by webhook events
// =============================================================================

export async function provisionGitHubAccess(githubUsername: string): Promise<void> {
  const token = process.env.REVEALUI_GITHUB_TOKEN;
  if (!token) {
    logger.warn('REVEALUI_GITHUB_TOKEN not configured — skipping GitHub team provisioning', {
      githubUsername,
    });
    return;
  }

  const { fetchWithRetry } = await import('@revealui/core/error-handling');

  const url = `https://api.github.com/orgs/RevealUIStudio/teams/revealui-pro-customers/memberships/${githubUsername}`;

  await fetchWithRetry(
    url,
    {
      method: 'PUT',
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header convention
        Authorization: `Bearer ${token}`,
        // biome-ignore lint/style/useNamingConvention: HTTP header convention
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'RevealUI-License-Server/1.0',
      },
      body: JSON.stringify({ role: 'member' }),
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      onRetry: (error, attempt) => {
        logger.warn('Retrying GitHub team provisioning', {
          githubUsername,
          attempt,
          error: error.message,
        });
      },
    },
  );

  logger.info('GitHub team access provisioned', { githubUsername });
}
