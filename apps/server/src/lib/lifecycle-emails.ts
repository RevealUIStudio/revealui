/**
 * Onboarding lifecycle emails (day-0 welcome, day-1 check-in, day-7 outcome).
 *
 * Net-new sequence riding the existing email transport and template helpers:
 * the copy builders below return { subject, html, text } and the senders hand
 * them to `sendEmail` (apps/server/src/lib/email.ts), reusing `emailShell`,
 * `ctaButton`, `supportFooter`, `tierLabel`, and `adminUrl` from
 * ./email-templates.ts (the same helpers the Stripe webhook emails use).
 *
 * SENDING IS ARMED SEPARATELY. The cron job that calls these senders uses
 * resolveLifecycleEmailArming: hosted test/staging arms when the Gmail
 * mailbox path is present; production stays disarmed unless the operator
 * sets LIFECYCLE_EMAILS_ENABLED=true after a delivery check. See
 * routes/cron/lifecycle-emails.ts. The cron never sends an Enterprise trial
 * sequence.
 */

import { sendEmail } from './email.js';
import { adminUrl, ctaButton, emailShell, supportFooter, tierLabel } from './email-templates.js';

export type LifecycleTier = 'free' | 'pro' | 'max' | 'enterprise';

export interface LifecycleEmailContent {
  subject: string;
  html: string;
  text: string;
}

function isPaidTier(tier: LifecycleTier): boolean {
  return tier === 'pro' || tier === 'max' || tier === 'enterprise';
}

function licenseUrl(): string {
  return `${adminUrl()}/account/license`;
}

function dashboardUrl(): string {
  return `${adminUrl()}/admin`;
}

// =============================================================================
// Day 0 — welcome (tier-aware)
// =============================================================================

export function buildDay0Welcome(tier: LifecycleTier): LifecycleEmailContent {
  if (isPaidTier(tier)) {
    const label = tierLabel(tier);
    return {
      subject: `Your RevealUI ${label} license key is ready`,
      html: emailShell(
        `Your ${label} license key is ready`,
        `<h1 style="color: #2563eb;">Your ${label} license key is ready</h1>
<p>Welcome to RevealUI ${label}. Here are the two things worth doing first.</p>
<p>Your license key is waiting on your account page. Wire it into your runtime and your ${label} features turn on.</p>
${ctaButton(licenseUrl(), 'View your license key')}
<p>Then run your first agent. Hand it a task on your own data. If an agent did it, there's a receipt.</p>
${ctaButton(dashboardUrl(), 'Run your first agent')}
${supportFooter('If you have questions')}`,
      ),
      text: `Welcome to RevealUI ${label}. Two things worth doing first.\n\n1. Your license key is waiting on your account page. Wire it into your runtime and your ${label} features turn on: ${licenseUrl()}\n\n2. Run your first agent. Hand it a task on your own data, and check the receipt it leaves behind. If an agent did it, there's a receipt: ${dashboardUrl()}`,
    };
  }

  return {
    subject: 'Welcome to RevealUI. Your first agent reply is one message away.',
    html: emailShell(
      'Welcome to RevealUI',
      `<h1 style="color: #2563eb;">Welcome to RevealUI</h1>
<p>Your account is ready. The fastest way to feel what RevealUI does is to talk to an agent.</p>
<p>Open your dashboard, find the agent chat, and send it a message. Getting that first reply is the whole point of your first few minutes.</p>
${ctaButton(dashboardUrl(), 'Open your dashboard')}
<p>When you want agents that act on your data and leave a receipt for every action, Pro is one step up.</p>
${supportFooter('If you have questions')}`,
    ),
    text: `Welcome to RevealUI. Your account is ready.\n\nThe fastest way to feel what RevealUI does is to talk to an agent. Open your dashboard, find the agent chat, and send it a message. Getting that first reply is the whole point of your first few minutes: ${dashboardUrl()}\n\nWhen you want agents that act on your data and leave a receipt for every action, Pro is one step up.`,
  };
}

// =============================================================================
// Day 1 — check-in (only sent when no agent action exists yet)
// =============================================================================

export function buildDay1Checkin(_tier: LifecycleTier): LifecycleEmailContent {
  return {
    subject: 'You are one task away from your first agent action',
    html: emailShell(
      'One task is all it takes',
      `<h1 style="color: #2563eb;">One task is all it takes</h1>
<p>You joined RevealUI a day or so ago and have not put an agent to work yet.</p>
<p>It takes one task. Open your dashboard, hand an agent something small, and watch it work. That first action is where RevealUI starts earning its place in your stack.</p>
${ctaButton(dashboardUrl(), 'Open your dashboard')}
${supportFooter('If you have questions')}`,
    ),
    text: `You joined RevealUI a day or so ago and have not put an agent to work yet.\n\nIt takes one task. Open your dashboard, hand an agent something small, and watch it work. That first action is where RevealUI starts earning its place in your stack: ${dashboardUrl()}`,
  };
}

// =============================================================================
// Day 7 — outcome (receipt-count framing, honest zero-state)
// =============================================================================

export function buildDay7Outcome(
  tier: LifecycleTier,
  weeklyAgentActions: number,
): LifecycleEmailContent {
  // Paid tiers get a note about the renewal path so a shortened-TTL key never
  // strands a running instance: the key renews on the billing cycle and the
  // instance can pull the current key from the refresh endpoint. The one-line
  // command lives on the license page (GAP-287 PR-1, GAP-300 surface).
  const renewalHtml = isPaidTier(tier)
    ? `<p>One more thing worth knowing. Your license key renews on your billing cycle, and a running instance can pull the current key from the refresh endpoint, so a renewal reaches your deployment on its own. The one-line command is on your license page.</p>
${ctaButton(licenseUrl(), 'See the renewal command')}`
    : '';
  const renewalText = isPaidTier(tier)
    ? `\n\nOne more thing worth knowing. Your license key renews on your billing cycle, and a running instance can pull the current key from the refresh endpoint, so a renewal reaches your deployment on its own. The one-line command is on your license page: ${licenseUrl()}`
    : '';

  if (weeklyAgentActions > 0) {
    const noun = weeklyAgentActions === 1 ? 'action' : 'actions';
    return {
      subject: 'Your first week with RevealUI',
      html: emailShell(
        'Your first week with RevealUI',
        `<h1 style="color: #2563eb;">Your first week with RevealUI</h1>
<p>Here is your first week with RevealUI. Your agents took ${weeklyAgentActions} ${noun} this week, and every one of them left a receipt you can check.</p>
<p>Open your dashboard to see exactly what your agents did and when.</p>
${ctaButton(dashboardUrl(), 'Open your dashboard')}
${renewalHtml}
${supportFooter('If you have questions')}`,
      ),
      text: `Here is your first week with RevealUI. Your agents took ${weeklyAgentActions} ${noun} this week, and every one of them left a receipt you can check.\n\nOpen your dashboard to see exactly what your agents did and when: ${dashboardUrl()}${renewalText}`,
    };
  }

  return {
    subject: 'Your first week with RevealUI',
    html: emailShell(
      'Your first week with RevealUI',
      `<h1 style="color: #2563eb;">Your first week with RevealUI</h1>
<p>You are a week into RevealUI and your agents have not acted yet. We would rather show you an honest zero than dress it up.</p>
<p>The value shows up the moment an agent does something on your data, because it leaves a receipt you can check. One task is enough to see it.</p>
${ctaButton(dashboardUrl(), 'Run your first agent')}
${renewalHtml}
${supportFooter('If you have questions')}`,
    ),
    text: `You are a week into RevealUI and your agents have not acted yet. We would rather show you an honest zero than dress it up.\n\nThe value shows up the moment an agent does something on your data, because it leaves a receipt you can check. One task is enough to see it: ${dashboardUrl()}${renewalText}`,
  };
}

// =============================================================================
// Senders — hand the built content to the shared transport
// =============================================================================

export async function sendDay0Welcome(to: string, tier: LifecycleTier): Promise<void> {
  const { subject, html, text } = buildDay0Welcome(tier);
  await sendEmail({ to, subject, html, text });
}

export async function sendDay1Checkin(to: string, tier: LifecycleTier): Promise<void> {
  const { subject, html, text } = buildDay1Checkin(tier);
  await sendEmail({ to, subject, html, text });
}

export async function sendDay7Outcome(
  to: string,
  tier: LifecycleTier,
  weeklyAgentActions: number,
): Promise<void> {
  const { subject, html, text } = buildDay7Outcome(tier, weeklyAgentActions);
  await sendEmail({ to, subject, html, text });
}
