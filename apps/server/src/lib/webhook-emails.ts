/**
 * Email templates for Stripe webhook lifecycle events.
 *
 * Extracted from webhooks.ts to reduce file size and separate
 * concerns (email content vs. webhook business logic).
 */

import { logger } from '@revealui/core/observability/logger';
import type { Database } from '@revealui/db/client';
import { appLogs } from '@revealui/db/schema';
import { sendEmail } from './email.js';
import {
  adminUrl,
  billingUrl,
  ctaButton,
  emailShell,
  supportEmail,
  supportFooter,
  tierLabel,
} from './email-templates.js';
import { escapeHtml } from './html.js';

// Email clients can't consume CSS custom properties, so table borders in
// these templates ship as literal sRGB values instead of var(--mkt-border).
const EMAIL_BORDER = '#e5e7eb'; // adherence-ignore: grey-hex - literal sRGB equivalent of --mkt-border; email HTML can't reference CSS custom properties, reviewed for email-safety

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

function formatStripeAmount(amountInSmallest: number, currency: string): string {
  const cur = currency.toLowerCase();
  const value = ZERO_DECIMAL_CURRENCIES.has(cur) ? amountInSmallest : amountInSmallest / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur.toUpperCase(),
  }).format(value);
}

// =============================================================================
// Email senders
// =============================================================================

export async function sendLicenseActivatedEmail(to: string, tier: string): Promise<void> {
  const label = tierLabel(tier);
  const featureList =
    tier === 'enterprise'
      ? ' multi-tenant architecture, and'
      : tier === 'max'
        ? ' AI memory, advanced inference, audit log, and'
        : '';

  await sendEmail({
    to,
    subject: `Your RevealUI ${label} license is active`,
    html: emailShell(
      'License Activated',
      `<h1 style="color: #2563eb;">Your License is Active</h1>
<p>Your RevealUI <strong>${label}</strong> license has been activated.</p>
<p>You now have access to all ${label} features including${featureList} AI agents, advanced sync, and built-in payments.</p>
${ctaButton(`${adminUrl()}/admin`, 'Go to Dashboard')}
${supportFooter('If you have questions, reply to this email or contact')}`,
    ),
    text: `Your RevealUI ${label} license is now active. Go to your dashboard to explore your new features.`,
  });
}

export async function sendPaymentActionRequiredEmail(to: string, tier = 'pro'): Promise<void> {
  const portal = billingUrl();
  const label = tierLabel(tier);
  await sendEmail({
    to,
    subject: `Action required: authenticate your RevealUI payment`,
    html: emailShell(
      'Authentication Required',
      `<h1 style="color: #2563eb;">Authentication Required</h1>
<p>Your RevealUI ${escapeHtml(label)} subscription renewal requires additional authentication from your bank (3D Secure / Strong Customer Authentication).</p>
<p>Your access is <strong>not interrupted</strong> — but to avoid a payment failure on the next retry, please complete authentication on your billing portal:</p>
${ctaButton(portal, 'Complete Authentication')}
${supportFooter('If you have questions, contact')}`,
    ),
    text: `Your RevealUI ${label} renewal requires 3D Secure authentication from your bank. Your access is not interrupted. Complete authentication at ${portal} to avoid a payment failure.`,
  });
}

export async function sendPaymentFailedEmail(to: string, tier = 'pro'): Promise<void> {
  const portal = billingUrl();
  const label = tierLabel(tier);
  await sendEmail({
    to,
    subject: `Action required: RevealUI payment failed`,
    html: emailShell(
      'Payment Failed',
      `<h1 style="color: #dc2626;">Payment Failed</h1>
<p>We were unable to process your RevealUI subscription payment. Your ${escapeHtml(label)} features may be restricted until payment is resolved.</p>
<p>Please update your payment method to continue using ${escapeHtml(label)} features:</p>
${ctaButton(portal, 'Update Payment Method')}
${supportFooter('If you believe this is an error, contact')}`,
    ),
    text: `Your RevealUI subscription payment failed. Please update your payment method at ${portal} to continue using ${label} features.`,
  });
}

export async function sendTrialEndingEmail(
  to: string,
  trialEnd: number | null,
  tier = 'pro',
): Promise<void> {
  const endDate = trialEnd
    ? new Date(trialEnd * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'soon';
  const portal = billingUrl();
  const label = tierLabel(tier);
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} trial ends soon`,
    html: emailShell(
      'Trial Ending',
      `<h1 style="color: #2563eb;">Your Trial Ends ${endDate}</h1>
<p>Your RevealUI ${escapeHtml(label)} free trial is ending ${endDate}. After the trial, your subscription will automatically continue.</p>
<p>If you'd like to continue with ${escapeHtml(label)} features, no action is needed  -  your subscription will start automatically.</p>
<p>If you'd like to cancel or change your plan, you can do so from your billing page:</p>
${ctaButton(portal, 'Manage Subscription')}
${supportFooter('Questions? Contact')}`,
    ),
    text: `Your RevealUI ${label} trial ends ${endDate}. Your subscription will continue automatically. Manage your subscription at ${portal}.`,
  });
}

export async function sendPaymentRecoveredEmail(to: string, tier = 'pro'): Promise<void> {
  const portal = billingUrl();
  const label = tierLabel(tier);
  await sendEmail({
    to,
    subject: 'Your RevealUI access has been restored',
    html: emailShell(
      'Access Restored',
      `<h1 style="color: #16a34a;">Payment Received — Access Restored</h1>
<p>Your RevealUI subscription payment was successfully processed. Your ${escapeHtml(label)} access has been fully restored.</p>
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
  licenseKey?: string,
): Promise<void> {
  const label = tierLabel(tier);
  const supportExpiry = supportExpiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const licenseUrl = `${adminUrl()}/account/license`;
  const keyBlock = licenseKey
    ? `<div style="margin: 20px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
  <p style="margin: 0 0 8px 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Your License Key</p>
  <code style="word-break: break-all; font-size: 13px; color: #18181b;">${escapeHtml(licenseKey)}</code>
</div>
<p style="font-size: 14px; color: #666;">Add this to your project's <code>.env</code> file as <code>REVEALUI_LICENSE_KEY=your-key</code>, or pass it via <code>initializeLicense(key)</code> at startup.</p>`
    : '';
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} Perpetual License is ready`,
    html: emailShell(
      'Perpetual License Activated',
      `<h1 style="color: #2563eb;">Your Perpetual License is Active</h1>
<p>Thank you for purchasing RevealUI <strong>${label} Perpetual</strong>. Your license never expires.</p>
${keyBlock}
<p>Your purchase includes <strong>1 year of support</strong> (until ${supportExpiry}). You'll receive a reminder 30 days before it lapses.</p>
${ctaButton(licenseUrl, 'View Your License')}
${supportFooter('Questions? Reply to this email or contact')}`,
    ),
    text: `Your RevealUI ${label} Perpetual License is now active.${licenseKey ? ` License key: ${licenseKey}` : ''} The license never expires. Your 1-year support contract runs until ${supportExpiry}. View your license at ${licenseUrl}.`,
  });
}

export async function sendSupportRenewalConfirmationEmail(
  to: string,
  tier: string,
  newSupportExpiresAt: Date,
): Promise<void> {
  const label = tierLabel(tier);
  const newExpiry = newSupportExpiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const licenseUrl = `${adminUrl()}/account/license`;
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} support contract has been renewed`,
    html: emailShell(
      'Support Renewed',
      `<h1 style="color: #2563eb;">Support Contract Renewed</h1>
<p>Thank you for renewing your RevealUI <strong>${escapeHtml(label)}</strong> support contract.</p>
<p>Your new support period runs until <strong>${newExpiry}</strong>. You'll continue to receive priority support, updates, and private GitHub repo access.</p>
<p>Your perpetual license itself never expires  -  only the support contract requires annual renewal.</p>
${ctaButton(licenseUrl, 'View Your License')}
${supportFooter('Questions? Reply to this email or contact')}`,
    ),
    text: `Your RevealUI ${label} support contract has been renewed. New support expiry: ${newExpiry}. Your perpetual license never expires. View your license at ${licenseUrl}.`,
  });
}

export async function sendPaymentReceiptEmail(
  to: string,
  params: {
    amountPaid: number;
    currency: string;
    invoiceNumber: string | null;
    tier: string;
    periodEnd: Date | null;
    invoiceUrl: string | null;
  },
): Promise<void> {
  const label = tierLabel(params.tier);
  const amount = formatStripeAmount(params.amountPaid, params.currency);
  const currency = params.currency.toUpperCase();
  const invoiceNum = params.invoiceNumber ?? 'N/A';
  const nextBilling = params.periodEnd
    ? params.periodEnd.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A';

  const invoiceLink = params.invoiceUrl
    ? `<p><a href="${params.invoiceUrl}" style="color: #2563eb;">View full invoice on Stripe</a></p>`
    : '';

  await sendEmail({
    to,
    subject: `RevealUI payment receipt — ${currency} ${amount}`,
    html: emailShell(
      'Payment Receipt',
      `<h1 style="color: #16a34a;">Payment Received</h1>
<p>Thank you for your RevealUI <strong>${label}</strong> subscription payment.</p>
<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
  <tr style="border-bottom: 1px solid ${EMAIL_BORDER};">
    <td style="padding: 8px 0; color: #666;">Amount</td>
    <td style="padding: 8px 0; text-align: right; font-weight: bold;">${currency} ${amount}</td>
  </tr>
  <tr style="border-bottom: 1px solid ${EMAIL_BORDER};">
    <td style="padding: 8px 0; color: #666;">Plan</td>
    <td style="padding: 8px 0; text-align: right;">${label}</td>
  </tr>
  <tr style="border-bottom: 1px solid ${EMAIL_BORDER};">
    <td style="padding: 8px 0; color: #666;">Invoice</td>
    <td style="padding: 8px 0; text-align: right;">${escapeHtml(invoiceNum)}</td>
  </tr>
  <tr>
    <td style="padding: 8px 0; color: #666;">Next billing date</td>
    <td style="padding: 8px 0; text-align: right;">${nextBilling}</td>
  </tr>
</table>
${invoiceLink}
${ctaButton(billingUrl(), 'Manage Subscription')}
${supportFooter('If you have questions about this charge, contact')}`,
    ),
    text: `Payment received: ${currency} ${amount} for RevealUI ${label}. Invoice: ${invoiceNum}. Next billing: ${nextBilling}. Manage subscription at ${billingUrl()}.`,
  });
}

export async function sendCancellationConfirmationEmail(to: string, tier = 'pro'): Promise<void> {
  const portal = billingUrl();
  const label = tierLabel(tier);
  await sendEmail({
    to,
    subject: 'Your RevealUI subscription has been cancelled',
    html: emailShell(
      'Subscription Cancelled',
      `<h1 style="color: #333;">Subscription Cancelled</h1>
<p>Your RevealUI ${escapeHtml(label)} subscription has been cancelled and your license has been revoked.</p>
<p>You can continue using RevealUI's free-tier features. If you'd like to resubscribe at any time, visit your billing page:</p>
${ctaButton(portal, 'Resubscribe')}
${supportFooter('If you believe this is an error, contact')}`,
    ),
    text: `Your RevealUI ${label} subscription has been cancelled. You can resubscribe at any time at ${portal}.`,
  });
}

export async function sendGracePeriodStartedEmail(
  to: string,
  graceUntil: Date,
  tier = 'pro',
): Promise<void> {
  const portal = billingUrl();
  const label = tierLabel(tier);
  const deadline = graceUntil.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  await sendEmail({
    to,
    subject: `Action required: update your payment by ${deadline}`,
    html: emailShell(
      'Grace Period Started',
      `<h1 style="color: #d97706;">Payment Issue — Grace Period Active</h1>
<p>We were unable to process your RevealUI subscription payment. Your ${escapeHtml(label)} features remain active during a grace period until <strong>${deadline}</strong>.</p>
<p>Please update your payment method before the deadline to avoid losing access:</p>
${ctaButton(portal, 'Update Payment Method', '#d97706')}
<p style="color: #666; font-size: 14px;">After ${deadline}, your access will be downgraded to the free tier until payment is resolved.</p>
${supportFooter('If you believe this is an error, contact')}`,
    ),
    text: `Your RevealUI subscription payment failed. Your ${label} features remain active until ${deadline}. Update your payment method at ${portal} to avoid losing access.`,
  });
}

export async function sendPerpetualLicenseRevokedEmail(
  to: string,
  opts: { tier: string; amountRefunded: number; currency: string },
): Promise<void> {
  const support = supportEmail();
  const amountStr = formatStripeAmount(opts.amountRefunded, opts.currency);
  const currencyUpper = opts.currency.toUpperCase();
  const label = tierLabel(opts.tier);
  await sendEmail({
    to,
    subject: 'Your RevealUI perpetual license has been revoked',
    html: emailShell(
      'Perpetual License Revoked',
      `<h1 style="color: #dc2626;">Perpetual License Revoked</h1>
<p>A full refund of <strong>${amountStr} ${escapeHtml(currencyUpper)}</strong> has been issued for your RevealUI ${escapeHtml(label)} Perpetual License.</p>
<p>Because the purchase has been fully refunded, your perpetual license has been revoked and access has been removed.</p>
<p>If you believe this was issued in error, please contact us at <a href="mailto:${support}">${support}</a> and we will be happy to assist.</p>
${supportFooter('If you have questions about this revocation, contact')}`,
    ),
    text: `A full refund of ${amountStr} ${currencyUpper} has been issued for your RevealUI ${label} Perpetual License. Your license has been revoked. Contact ${support} if you believe this was issued in error.`,
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

export async function sendRefundProcessedEmail(
  to: string,
  opts: { isFullRefund: boolean; amountRefunded: number; currency: string },
): Promise<void> {
  const portal = billingUrl();
  const amountStr = formatStripeAmount(opts.amountRefunded, opts.currency);
  const currencyUpper = opts.currency.toUpperCase();

  if (opts.isFullRefund) {
    await sendEmail({
      to,
      subject: 'Your RevealUI subscription has been refunded',
      html: emailShell(
        'Refund Processed',
        `<h1 style="color: #333;">Refund Processed</h1>
<p>A full refund of <strong>${amountStr} ${escapeHtml(currencyUpper)}</strong> has been issued to your payment method.</p>
<p>Your RevealUI license has been deactivated. You can continue using the free tier, and your data will be preserved.</p>
<p>If you'd like to resubscribe in the future, you can do so from your billing page:</p>
${ctaButton(portal, 'View Billing')}
${supportFooter('If you did not request this refund, contact')}`,
      ),
      text: `A full refund of ${amountStr} ${currencyUpper} has been issued. Your RevealUI license has been deactivated. Resubscribe at ${portal}. Contact ${supportEmail()} if you have questions.`,
    });
  } else {
    await sendEmail({
      to,
      subject: 'RevealUI: Partial refund processed',
      html: emailShell(
        'Partial Refund',
        `<h1 style="color: #333;">Partial Refund Processed</h1>
<p>A partial refund of <strong>${amountStr} ${escapeHtml(currencyUpper)}</strong> has been issued to your payment method.</p>
<p>Your subscription and access remain active  -  no action is needed on your part.</p>
${ctaButton(portal, 'View Billing')}
${supportFooter()}`,
      ),
      text: `A partial refund of ${amountStr} ${currencyUpper} has been issued. Your subscription remains active. View billing at ${portal}.`,
    });
  }
}

export async function sendTrialExpiredEmail(to: string, tier = 'pro'): Promise<void> {
  const portal = billingUrl();
  const label = tierLabel(tier);
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} trial has ended`,
    html: emailShell(
      'Trial Expired',
      `<h1 style="color: #333;">Your Trial Has Ended</h1>
<p>Your RevealUI <strong>${escapeHtml(label)}</strong> free trial has expired. Your subscription is now active and billing will begin.</p>
<p>You'll continue to have full access to all ${escapeHtml(label)} features. Manage your subscription from your billing page:</p>
${ctaButton(portal, 'Manage Subscription')}
${supportFooter('If you have questions, contact')}`,
    ),
    text: `Your RevealUI ${label} trial has ended and your subscription is now active. Manage your subscription at ${portal}.`,
  });
}

export async function sendUpgradeConfirmationEmail(
  to: string,
  opts: { fromTier: string; toTier: string },
): Promise<void> {
  const portal = billingUrl();
  const fromLabel = tierLabel(opts.fromTier);
  const toLabel = tierLabel(opts.toTier);
  await sendEmail({
    to,
    subject: `Your RevealUI plan has been upgraded to ${toLabel}`,
    html: emailShell(
      'Plan Upgraded',
      `<h1 style="color: #16a34a;">Plan Upgraded</h1>
<p>Your RevealUI plan has been upgraded from <strong>${escapeHtml(fromLabel)}</strong> to <strong>${escapeHtml(toLabel)}</strong>.</p>
<p>Your new features are available immediately. The prorated charge will appear on your next invoice.</p>
${ctaButton(`${adminUrl()}/admin`, 'Explore New Features')}
${supportFooter('If you have questions about your upgrade, contact')}`,
    ),
    text: `Your RevealUI plan has been upgraded from ${fromLabel} to ${toLabel}. Your new features are available immediately. Manage your subscription at ${portal}.`,
  });
}

export async function sendDowngradeConfirmationEmail(
  to: string,
  opts: { fromTier: string; toTier: string; effectiveDate: string },
): Promise<void> {
  const portal = billingUrl();
  const fromLabel = tierLabel(opts.fromTier);
  const toLabel = opts.toTier === 'free' ? 'Free' : tierLabel(opts.toTier);
  await sendEmail({
    to,
    subject: `Your RevealUI plan will change to ${toLabel}`,
    html: emailShell(
      'Plan Downgrade Scheduled',
      `<h1 style="color: #333;">Plan Change Scheduled</h1>
<p>Your RevealUI plan will change from <strong>${escapeHtml(fromLabel)}</strong> to <strong>${escapeHtml(toLabel)}</strong> on <strong>${escapeHtml(opts.effectiveDate)}</strong>.</p>
<p>You'll retain full ${escapeHtml(fromLabel)} access until then. After the change, ${escapeHtml(toLabel)}-tier features will apply.</p>
<p>Changed your mind? You can cancel the downgrade from your billing page:</p>
${ctaButton(portal, 'Manage Subscription')}
${supportFooter('If you have questions, contact')}`,
    ),
    text: `Your RevealUI plan will change from ${fromLabel} to ${toLabel} on ${opts.effectiveDate}. You'll retain full ${fromLabel} access until then. Cancel the change at ${portal}.`,
  });
}

export async function sendDisputeReceivedEmail(to: string): Promise<void> {
  const support = supportEmail();
  await sendEmail({
    to,
    subject: 'RevealUI: A payment dispute has been opened on your account',
    html: emailShell(
      'Payment Dispute Opened',
      `<h1 style="color: #d97706;">Payment Dispute Opened</h1>
<p>A payment dispute (chargeback) has been opened for a charge on your RevealUI account.</p>
<p>While the dispute is being reviewed, your access remains active. If the dispute is resolved in your favor, no action is needed.</p>
<p>If you did not initiate this dispute, please contact us immediately at <a href="mailto:${support}">${support}</a> so we can help resolve it.</p>
${supportFooter('For urgent questions, contact')}`,
    ),
    text: `A payment dispute has been opened on your RevealUI account. Your access remains active during review. If you did not initiate this, contact ${support} immediately.`,
  });
}

export async function sendTierFallbackAlert(
  email: string,
  context: { tier: string | null; metadata: Record<string, string> | null },
): Promise<void> {
  await sendEmail({
    to: email,
    subject: '[CRITICAL] RevealUI: Stripe tier metadata missing  -  defaulted to pro',
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

export async function sendCronFailureAlert(
  email: string,
  ctx: {
    jobName: string;
    error: string;
    severity?: 'critical' | 'warning';
    details?: Record<string, string | number>;
  },
): Promise<void> {
  const level = ctx.severity ?? 'critical';
  const prefix = level === 'critical' ? '[CRITICAL]' : '[WARNING]';
  const detailRows =
    ctx.details && Object.keys(ctx.details).length > 0
      ? Object.entries(ctx.details)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 8px;font-weight:bold;">${escapeHtml(k)}</td><td style="padding:4px 8px;">${escapeHtml(String(v))}</td></tr>`,
          )
          .join('')
      : '';
  const detailTable = detailRows
    ? `<table style="border-collapse:collapse;margin-top:8px;">${detailRows}</table>`
    : '';

  await sendEmail({
    to: email,
    subject: `${prefix} RevealUI cron job ${ctx.jobName} failure`,
    html: emailShell(
      'Cron Job Failure',
      `<h1 style="color: #dc2626;">Cron Job Failure</h1>
<p><strong>Job:</strong> <code>${escapeHtml(ctx.jobName)}</code></p>
<p><strong>Severity:</strong> ${escapeHtml(level.toUpperCase())}</p>
<p><strong>Error:</strong> ${escapeHtml(ctx.error)}</p>
<p><strong>Time:</strong> ${escapeHtml(new Date().toISOString())}</p>
${detailTable ? `<p><strong>Context:</strong></p>${detailTable}` : ''}
<p style="margin-top:16px;"><a href="${adminUrl()}/ops/cron" style="color:#2563eb;">Review in admin dashboard →</a></p>`,
    ),
    text: `${prefix} RevealUI cron job failure\n\nJob: ${ctx.jobName}\nSeverity: ${level.toUpperCase()}\nError: ${ctx.error}\nTime: ${new Date().toISOString()}${
      ctx.details
        ? `\n\nContext:\n${Object.entries(ctx.details)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n')}`
        : ''
    }\n\nReview at ${adminUrl()}/ops/cron`,
  });
}

// =============================================================================
// GitHub team provisioning  -  side-effect triggered by webhook events
// =============================================================================

interface GitHubMembershipResponse {
  state: string;
  role: string;
  url: string;
}

/**
 * Add a GitHub user to the revealui-pro-customers team.
 *
 * - Retries up to 3 times with exponential backoff (1 s / 2 s / 4 s)
 * - Confirms the response state is 'active' or 'pending'
 * - On permanent failure, writes an error row to app_logs (if db provided)
 *   and re-throws so the caller can capture the event
 */
export async function provisionGitHubAccess(githubUsername: string, db?: Database): Promise<void> {
  const token = process.env.REVEALUI_GITHUB_TOKEN;
  if (!token) {
    logger.warn('REVEALUI_GITHUB_TOKEN not configured  -  skipping GitHub team provisioning', {
      githubUsername,
    });
    return;
  }

  const { fetchWithRetry } = await import('@revealui/core/error-handling');

  const url = `https://api.github.com/orgs/RevealUIStudio/teams/revealui-pro-customers/memberships/${githubUsername}`;

  let response: Response;
  try {
    response = await fetchWithRetry(
      url,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
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
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    logger.error('GitHub team provisioning failed after all retries', errObj, { githubUsername });
    if (db) {
      // Explicit app_logs write so the failure is queryable even if the
      // logger transport is not configured (e.g. local dev, staging).
      await db.insert(appLogs).values({
        level: 'error',
        message: 'GitHub team provisioning failed after all retries',
        app: 'api',
        data: { githubUsername, error: errObj.message },
      });
    }
    throw err;
  }

  // Confirm the membership state returned by GitHub.
  // Both 'active' (existing member) and 'pending' (invitation sent) are success states.
  const body = (await response.json()) as GitHubMembershipResponse;
  if (body.state !== 'active' && body.state !== 'pending') {
    logger.warn('GitHub team provisioning returned unexpected membership state', {
      githubUsername,
      state: body.state,
    });
  } else {
    logger.info('GitHub team access provisioned', { githubUsername, state: body.state });
  }
}

export async function sendLivemodeMismatchAlert(
  email: string,
  context: {
    eventId: string;
    eventType: string;
    eventLivemode: boolean;
    serverExpectsLive: boolean;
  },
): Promise<void> {
  const received = context.eventLivemode ? 'LIVE' : 'TEST';
  const expected = context.serverExpectsLive ? 'LIVE' : 'TEST';
  await sendEmail({
    to: email,
    subject: `[SECURITY] RevealUI: Webhook livemode mismatch — received ${received}, expected ${expected}`,
    html: emailShell(
      'Webhook Livemode Mismatch',
      `<h1 style="color: #dc2626;">Security Alert: Webhook Livemode Mismatch</h1>
<p>A Stripe webhook event was rejected because its <code>livemode</code> flag does not match the server's deployment mode. The event was NOT processed.</p>
<p><strong>Event ID:</strong> <code>${escapeHtml(context.eventId)}</code></p>
<p><strong>Event Type:</strong> <code>${escapeHtml(context.eventType)}</code></p>
<p><strong>Event livemode:</strong> ${received}</p>
<p><strong>Server expects:</strong> ${expected}</p>
<p style="color: #dc2626; font-weight: bold;">This may indicate a misconfigured Stripe webhook endpoint, a routing error, or an attempted cross-mode replay. Investigate immediately.</p>`,
    ),
    text: `Security Alert: Webhook livemode mismatch.\n\nEvent ID: ${context.eventId}\nEvent Type: ${context.eventType}\nEvent livemode: ${received}\nServer expects: ${expected}\n\nThe event was NOT processed. Investigate immediately.`,
  });
}
