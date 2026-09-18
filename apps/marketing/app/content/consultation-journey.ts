/**
 * Consultee journey on existing Consultation surfaces (P1 / GAP-300).
 * Steps match the Consultation SSOT: choose → pay → prep → session →
 * artifacts → next. Not Studio Desk Sheet. Not a fourth SKU.
 */

import {
  CONSULTATION_PRICE,
  consultationSessionBuyerCopy,
} from '@revealui/contracts/public-catalog';

export const CONSULTATION_JOURNEY_PROGRESS_KEY = 'revealui-consultation-journey';

export const CONSULTATION_STEP_IDS = [
  'choose',
  'pay',
  'prep',
  'session',
  'artifacts',
  'next',
] as const;

export type ConsultationStepId = (typeof CONSULTATION_STEP_IDS)[number];

export interface ConsultationJourneyStep {
  readonly id: ConsultationStepId;
  readonly title: string;
  readonly body: string;
}

export const CONSULTATION_JOURNEY = {
  eyebrow: 'Consultation path',
  heading: 'Choose, pay, prep, meet, keep the pack.',
  body: 'A Consultation is one scoped session. You leave with notes and a next step, not a slide deck and a hope.',
  steps: [
    {
      id: 'choose',
      title: 'Choose',
      body: 'Pick Consultation when you need a founder session to name the problem and the next SKU. Pilot and Launch stay on the same ladder. There is no fourth product.',
    },
    {
      id: 'pay',
      title: 'Pay',
      body: `Invoice before the session begins. Consultation is ${CONSULTATION_PRICE}. You get a receipt you can keep.`,
    },
    {
      id: 'prep',
      title: 'Prep',
      body: 'Send the prep form so the session works on your actual stack, not a generic demo.',
    },
    {
      id: 'session',
      title: 'Session',
      body: consultationSessionBuyerCopy(),
    },
    {
      id: 'artifacts',
      title: 'Artifacts',
      body: 'Within one business day: notes, a next-step recommendation, and a stack sketch you can reuse.',
    },
    {
      id: 'next',
      title: 'Next',
      body: 'Optional Pilot or Launch if the session proved the path. You can also stop. Nothing is an email sequence.',
    },
  ] as const satisfies readonly ConsultationJourneyStep[],
} as const;

export interface ConsultationJourneyProgress {
  readonly completed: readonly ConsultationStepId[];
}

export function isConsultationStepId(value: unknown): value is ConsultationStepId {
  return (
    value === 'choose' ||
    value === 'pay' ||
    value === 'prep' ||
    value === 'session' ||
    value === 'artifacts' ||
    value === 'next'
  );
}

export function parseConsultationProgress(raw: unknown): ConsultationJourneyProgress {
  if (typeof raw !== 'object' || raw === null || !('completed' in raw)) {
    return { completed: [] };
  }
  const completedUnknown = (raw as { completed: unknown }).completed;
  if (!Array.isArray(completedUnknown)) return { completed: [] };
  const completed: ConsultationStepId[] = [];
  for (const id of CONSULTATION_STEP_IDS) {
    if (completedUnknown.includes(id) && !completed.includes(id)) {
      completed.push(id);
    }
  }
  return { completed };
}

export function toggleConsultationStep(
  current: ConsultationJourneyProgress,
  id: ConsultationStepId,
): ConsultationJourneyProgress {
  if (current.completed.includes(id)) {
    return { completed: current.completed.filter((step) => step !== id) };
  }
  return { completed: [...current.completed, id] };
}

export function readConsultationProgress(): ConsultationJourneyProgress {
  try {
    const raw = localStorage.getItem(CONSULTATION_JOURNEY_PROGRESS_KEY);
    if (!raw) return { completed: [] };
    return parseConsultationProgress(JSON.parse(raw) as unknown);
  } catch {
    return { completed: [] };
  }
}

export function writeConsultationProgress(progress: ConsultationJourneyProgress): void {
  try {
    localStorage.setItem(CONSULTATION_JOURNEY_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable
  }
}
