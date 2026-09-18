/**
 * First-day / first-24h hosted onboarding walk (GAP-300).
 *
 * Plan-gated steps for the dashboard checklist. Free never unlocks Pro
 * agent surfaces. Completion is live data plus persisted visits.
 */

import type { LicenseTierId } from '@revealui/contracts/pricing';
import { TIER_LABELS } from '@revealui/contracts/pricing';
import {
  LICENSE_SUBSCRIPTION_ANNUAL_PRICE_FALLBACKS,
  LICENSE_SUBSCRIPTION_PRICE_FALLBACKS,
} from '@/lib/utils/license-subscription-prices';

export const DISMISSED_KEY = 'revealui-onboarding-dismissed';
export const ONBOARDING_WALK_KEY = 'revealui-onboarding-walk';

export type WalkStepId =
  | 'dashboard'
  | 'planHonesty'
  | 'firstDayAction'
  | 'receiptedAction'
  | 'knowledgeGraph'
  | 'billing';

export interface WalkKgGate {
  /** Result of `canAccessKgShapes` (#2884). Do not invert or bypass. */
  kgShapesAllowed: boolean;
  /** Pro `ai` feature (same bar as LicenseGate + `/api/kg/repos`). */
  hasProAi: boolean;
}

export interface WalkStepOptions {
  /**
   * True only when the #2884 dual-gate plus Pro AI already allowed KG.
   * Callers should set this from `shouldSurfaceKgWalk` or a 200 from
   * `/api/kg/repos` (that route applies both checks). Default hidden.
   */
  kgEntitled?: boolean;
}

export type WalkStepKind = 'open' | 'locked';

export interface WalkStep {
  id: WalkStepId;
  label: string;
  description: string;
  href: string;
  kind: WalkStepKind;
}

export interface OnboardingWalkProgress {
  visited: Partial<Record<WalkStepId, boolean>>;
}

export interface WalkLiveSignals {
  hasAgents: boolean;
  hasAgentTasks: boolean;
  hasPages: boolean;
}

export interface WalkLicenseInput {
  tier: LicenseTierId;
  isLoading: boolean;
  resolveError: string | null;
}

const EMPTY_PROGRESS: OnboardingWalkProgress = { visited: {} };

export function entitlesReceiptedAgentAction(tier: LicenseTierId | null): boolean {
  return tier === 'pro' || tier === 'max' || tier === 'enterprise';
}

/** Fail closed: loading or a resolve error must not invent Free (GAP-454). */
export function resolveWalkTier(license: WalkLicenseInput): LicenseTierId | null {
  if (license.isLoading || license.resolveError) return null;
  return license.tier;
}

export function planHonestyLine(tier: LicenseTierId | null): string {
  const proMonthly = LICENSE_SUBSCRIPTION_PRICE_FALLBACKS.pro.price;
  const maxMonthly = LICENSE_SUBSCRIPTION_PRICE_FALLBACKS.max.price;
  const proAnnual = LICENSE_SUBSCRIPTION_ANNUAL_PRICE_FALLBACKS.pro.price;
  const maxAnnual = LICENSE_SUBSCRIPTION_ANNUAL_PRICE_FALLBACKS.max.price;
  const maxLine = `Max is ${maxMonthly}/mo · ${maxAnnual}/yr`;
  const proLine = `Pro is ${proMonthly}/mo`;

  if (tier === null) {
    return `Confirm your plan on billing. We will not guess Free. ${maxLine}.`;
  }
  if (tier === 'free') {
    return `You are on ${TIER_LABELS.free}. ${proLine}. ${maxLine}.`;
  }
  if (tier === 'pro') {
    return `You are on ${TIER_LABELS.pro}. ${proLine} · ${proAnnual}/yr. ${maxLine}.`;
  }
  if (tier === 'max') {
    return `You are on ${TIER_LABELS.max}. ${maxLine}.`;
  }
  return `You are on ${TIER_LABELS.enterprise}. Inquire / Contact sales, not unattended checkout.`;
}

export function shouldSurfaceKgWalk(gate: WalkKgGate): boolean {
  return gate.hasProAi === true && gate.kgShapesAllowed === true;
}

export function walkStepsForTier(
  tier: LicenseTierId | null,
  options: WalkStepOptions = {},
): WalkStep[] {
  const entitled = entitlesReceiptedAgentAction(tier);
  const firstDay: WalkStep = entitled
    ? {
        id: 'firstDayAction',
        label: 'Run an allowed agent',
        description: 'Open one agent your plan entitles and give it a real task.',
        href: '/agents',
        kind: 'open',
      }
    : {
        id: 'firstDayAction',
        label: 'Create your first page',
        description: 'Put a real page on the site. Free does not unlock Pro agents.',
        href: '/pages',
        kind: 'open',
      };

  const receipt: WalkStep = entitled
    ? {
        id: 'receiptedAction',
        label: 'See the receipt',
        description: 'Every entitled agent action leaves a task record you can inspect.',
        href: '/agent-tasks',
        kind: 'open',
      }
    : {
        id: 'receiptedAction',
        label: 'Receipted agent action',
        description:
          'Pro agents act on your business and every action leaves a receipt. Your free setup keeps working either way.',
        href: '/upgrade',
        kind: 'locked',
      };

  return [
    {
      id: 'dashboard',
      label: 'Land on the dashboard',
      description: 'You are signed in. This is the first-day home.',
      href: '/dashboard',
      kind: 'open',
    },
    {
      id: 'planHonesty',
      label: 'Confirm your plan',
      description: planHonestyLine(tier),
      href: '/account/billing',
      kind: 'open',
    },
    firstDay,
    receipt,
    ...(options.kgEntitled === true
      ? [
          {
            id: 'knowledgeGraph' as const,
            label: 'Open RevMind',
            description:
              'RevMind — architecture from your knowledge graph (Launch / licensed). Problems, stack, and the next SKU may land here after a recorded session. Status and links, not files. Graph wins over orphan slides. Not a fourth product. Not a public Architecture SKU.',
            href: '/knowledge-graph',
            kind: 'open' as const,
          } satisfies WalkStep,
        ]
      : []),
    {
      id: 'billing',
      label: 'Review account and billing',
      description:
        'License, invoices, and plan changes, without claiming features you did not buy.',
      href: '/account/billing',
      kind: 'open',
    },
  ];
}

export function resolveWalkCompletion(
  steps: readonly WalkStep[],
  signals: WalkLiveSignals,
  visited: Partial<Record<WalkStepId, boolean>>,
  landedOnDashboard: boolean,
): Record<WalkStepId, boolean> {
  const completion: Record<WalkStepId, boolean> = {
    dashboard: false,
    planHonesty: false,
    firstDayAction: false,
    receiptedAction: false,
    knowledgeGraph: false,
    billing: false,
  };

  for (const step of steps) {
    if (step.kind === 'locked') {
      completion[step.id] = false;
      continue;
    }
    if (step.id === 'dashboard') {
      completion.dashboard = landedOnDashboard || visited.dashboard === true;
      continue;
    }
    if (step.id === 'planHonesty') {
      completion.planHonesty = visited.planHonesty === true || visited.billing === true;
      continue;
    }
    if (step.id === 'firstDayAction') {
      completion.firstDayAction =
        step.href === '/pages'
          ? signals.hasPages || visited.firstDayAction === true
          : signals.hasAgents || visited.firstDayAction === true;
      continue;
    }
    if (step.id === 'receiptedAction') {
      completion.receiptedAction = signals.hasAgentTasks || visited.receiptedAction === true;
      continue;
    }
    if (step.id === 'knowledgeGraph') {
      completion.knowledgeGraph = visited.knowledgeGraph === true;
      continue;
    }
    completion.billing = visited.billing === true;
  }

  return completion;
}

export function walkProgressCounts(
  steps: readonly WalkStep[],
  completion: Record<WalkStepId, boolean>,
): { completed: number; total: number } {
  const open = steps.filter((step) => step.kind === 'open');
  return {
    completed: open.filter((step) => completion[step.id]).length,
    total: open.length,
  };
}

export function readWalkProgress(): OnboardingWalkProgress {
  try {
    const raw = localStorage.getItem(ONBOARDING_WALK_KEY);
    if (!raw) return { ...EMPTY_PROGRESS, visited: {} };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('visited' in parsed)) {
      return { ...EMPTY_PROGRESS, visited: {} };
    }
    const visitedUnknown = (parsed as { visited: unknown }).visited;
    if (typeof visitedUnknown !== 'object' || visitedUnknown === null) {
      return { ...EMPTY_PROGRESS, visited: {} };
    }
    const visited: Partial<Record<WalkStepId, boolean>> = {};
    const source = visitedUnknown as Record<string, unknown>;
    for (const id of [
      'dashboard',
      'planHonesty',
      'firstDayAction',
      'receiptedAction',
      'knowledgeGraph',
      'billing',
    ] as const) {
      if (source[id] === true) visited[id] = true;
    }
    return { visited };
  } catch {
    return { ...EMPTY_PROGRESS, visited: {} };
  }
}

export function writeWalkProgress(progress: OnboardingWalkProgress): void {
  try {
    localStorage.setItem(ONBOARDING_WALK_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable — persist in-memory only
  }
}

export function markWalkStepVisited(
  id: WalkStepId,
  current: OnboardingWalkProgress = readWalkProgress(),
): OnboardingWalkProgress {
  const next: OnboardingWalkProgress = {
    visited: { ...current.visited, [id]: true },
  };
  writeWalkProgress(next);
  return next;
}

export function wasWalkDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissWalk(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // localStorage unavailable — dismiss in-memory only
  }
}
