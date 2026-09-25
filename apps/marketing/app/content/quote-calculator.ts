// Product-site quote tool: one calculator, two exits, three questions.
// Same numbers as revealuistudio.com. This site defaults Who to I will.

import {
  CONSULTATION_PRICE,
  LAUNCH_PACKAGE_PRICE,
  PROOF_SPRINT_PRICE,
} from '@revealui/contracts/public-catalog';
import { PERPETUAL_PRICE_FALLBACKS, SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';
import { SITE } from './site';

export type WhoLive = 'self' | 'studio';
export type WhatWork = 'consultation' | 'proof-sprint' | 'launch';
export type PlaceCount = 'one' | 'many';

export interface QuoteAnswers {
  readonly who: WhoLive;
  readonly what: WhatWork;
  readonly places: PlaceCount;
}

export type QuoteKind = 'self-host' | 'studio' | 'intro';

export interface QuoteSkuLine {
  readonly id: WhatWork;
  readonly title: string;
  readonly price: string;
  readonly body: string;
  readonly highlighted: boolean;
}

export interface QuoteCta {
  readonly label: string;
  readonly href: string;
}

export interface QuoteResult {
  readonly kind: QuoteKind;
  readonly title: string;
  readonly price?: string;
  readonly lines: readonly string[];
  readonly skus?: readonly QuoteSkuLine[];
  readonly ownership: readonly string[];
  readonly startFreeCta?: QuoteCta;
  readonly introCta: QuoteCta & { readonly note: string };
}

export interface QuoteOption<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

const FREE_PRICE = SUBSCRIPTION_PRICE_FALLBACKS.free.price;
const PRO_PRICE = SUBSCRIPTION_PRICE_FALLBACKS.pro.price;
const MAX_PRICE = SUBSCRIPTION_PRICE_FALLBACKS.max.price;

function publicPerpetualPrice(): string {
  const fallback = PERPETUAL_PRICE_FALLBACKS['Pro Perpetual'];
  if (fallback === undefined) {
    throw new Error('Pro Perpetual is missing from PERPETUAL_PRICE_FALLBACKS');
  }
  return fallback.price;
}

const PERPETUAL_PRICE = publicPerpetualPrice();

export const DEFAULT_QUOTE_ANSWERS: QuoteAnswers = {
  who: 'self',
  what: 'proof-sprint',
  places: 'one',
};

export const QUOTE_CALCULATOR = {
  heading: 'Who runs it. What you need. One price.',
  body: 'Defaults to self-host licenses. Studio work is on the same form and books at revealuistudio.com.',
  questions: {
    who: {
      label: 'Who runs it?',
      options: [
        { id: 'self', label: 'I self-host the runtime' },
        { id: 'studio', label: 'Studio implements with me' },
      ] as const satisfies readonly QuoteOption<WhoLive>[],
    },
    what: {
      label: 'What problem are we solving?',
      options: [
        { id: 'consultation', label: 'Consultation: diagnose the path / proof gap' },
        { id: 'proof-sprint', label: 'Proof Sprint: one site, one receipted action I operate' },
        { id: 'launch', label: 'Launch: money path live on my accounts' },
      ] as const satisfies readonly QuoteOption<WhatWork>[],
    },
    places: {
      label: 'How many sites?',
      options: [
        { id: 'one', label: 'One business, one site' },
        { id: 'many', label: 'More than one: book an intro' },
      ] as const satisfies readonly QuoteOption<PlaceCount>[],
    },
  },
  selfHost: {
    title: 'Self-host licenses',
    free: `Free: ${FREE_PRICE} + your infra. Start free, or run \`npx create-revealui@latest\`.`,
    agents: `Pro ${PRO_PRICE}/mo or Max ${MAX_PRICE}/mo. 7-day trial.`,
    perpetual: `Optional one-time: Pro Perpetual ${PERPETUAL_PRICE}.`,
    enterprise: 'Enterprise: not in the calculator. Contact sales or book an intro.',
  },
  studio: {
    title: 'Studio',
    consultation: {
      title: 'Consultation',
      price: CONSULTATION_PRICE,
      body: 'Invoice before start.',
    },
    proofSprint: {
      title: 'Proof Sprint',
      price: PROOF_SPRINT_PRICE,
      body: 'One site and one receipted action you operate. Stage B is included. Credits 100% to Launch if you start Launch within 45 days.',
    },
    launch: {
      title: 'Launch',
      price: LAUNCH_PACKAGE_PRICE,
      body: 'Architecture work happens inside Launch, with a runbook and 30 days of async stabilization. Half now, half on delivery.',
    },
  },
  intro: {
    title: 'More than one site',
    body: 'The calculator stops here. Book a 30-minute intro to scope it.',
  },
  ownership: [
    'You own the accounts and the data.',
    'If we disappear, you still have the company.',
  ] as const,
  startFreeCta: {
    label: 'Start free',
    href: SITE.urls.signup,
  },
  introCta: {
    label: 'Book a 30-minute intro',
    note: 'Google Calendar / Google Meet.',
    href: SITE.urls.bookIntro,
  },
} as const;

function studioSkus(highlighted: WhatWork): readonly QuoteSkuLine[] {
  return [
    {
      id: 'consultation',
      title: QUOTE_CALCULATOR.studio.consultation.title,
      price: QUOTE_CALCULATOR.studio.consultation.price,
      body: QUOTE_CALCULATOR.studio.consultation.body,
      highlighted: highlighted === 'consultation',
    },
    {
      id: 'proof-sprint',
      title: QUOTE_CALCULATOR.studio.proofSprint.title,
      price: QUOTE_CALCULATOR.studio.proofSprint.price,
      body: QUOTE_CALCULATOR.studio.proofSprint.body,
      highlighted: highlighted === 'proof-sprint',
    },
    {
      id: 'launch',
      title: QUOTE_CALCULATOR.studio.launch.title,
      price: QUOTE_CALCULATOR.studio.launch.price,
      body: QUOTE_CALCULATOR.studio.launch.body,
      highlighted: highlighted === 'launch',
    },
  ];
}

export function resolveQuote(answers: QuoteAnswers): QuoteResult {
  const introCta = {
    label: QUOTE_CALCULATOR.introCta.label,
    note: QUOTE_CALCULATOR.introCta.note,
    href: QUOTE_CALCULATOR.introCta.href,
  };
  const ownership = [...QUOTE_CALCULATOR.ownership];

  if (answers.places === 'many') {
    return {
      kind: 'intro',
      title: QUOTE_CALCULATOR.intro.title,
      lines: [QUOTE_CALCULATOR.intro.body],
      ownership,
      introCta,
    };
  }

  if (answers.who === 'self') {
    return {
      kind: 'self-host',
      title: QUOTE_CALCULATOR.selfHost.title,
      lines: [
        QUOTE_CALCULATOR.selfHost.free,
        QUOTE_CALCULATOR.selfHost.agents,
        QUOTE_CALCULATOR.selfHost.perpetual,
        QUOTE_CALCULATOR.selfHost.enterprise,
      ],
      ownership,
      startFreeCta: {
        label: QUOTE_CALCULATOR.startFreeCta.label,
        href: QUOTE_CALCULATOR.startFreeCta.href,
      },
      introCta,
    };
  }

  return {
    kind: 'studio',
    title: QUOTE_CALCULATOR.studio.title,
    lines: studioSkus(answers.what).flatMap((sku) => [`${sku.title} ${sku.price}`, sku.body]),
    skus: studioSkus(answers.what),
    ownership,
    introCta,
  };
}
