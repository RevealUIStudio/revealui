/**
 * Shared HTML email presentation helpers.
 *
 * Extracted from webhook-emails.ts so the Stripe lifecycle emails and the
 * onboarding lifecycle sequence render from one implementation instead of
 * two copies. Pure string builders with no side effects.
 *
 * Email clients can't consume CSS custom properties, so colors ship as
 * literal sRGB values here rather than design-token variables.
 */

/** Maps a tier id to its customer-facing display label. */
export function tierLabel(tier: string): string {
  if (tier === 'enterprise') return 'Enterprise';
  if (tier === 'max') return 'Max';
  return 'Pro';
}

export function adminUrl(): string {
  return (
    process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://admin.revealui.com'
  );
}

export function billingUrl(): string {
  return `${adminUrl()}/account/billing`;
}

export function supportEmail(): string {
  return process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com';
}

export function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    ${body}
  </body>
</html>`;
}

export function ctaButton(href: string, label: string, color = '#2563eb'): string {
  return `<p style="text-align: center; margin: 30px 0;">
  <a href="${href}" style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    ${label}
  </a>
</p>`;
}

export function supportFooter(prefix = 'If you have questions'): string {
  return `<p style="color: #666; font-size: 14px;">${prefix}, contact ${supportEmail()}.</p>`;
}
