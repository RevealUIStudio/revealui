// Product-site quote tool: license plans on this form.
// Studio outcomes stay on revealuistudio.com. This site defaults Who to self-host.

import { PERPETUAL_PRICE_FALLBACKS, SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';
import { SITE } from './site';

export type WhoLive = 'self' | 'studio';
export type PlaceCount = 'one' | 'many';
export type QuoteSurface = 'home' | 'pricing';

export interface QuoteAnswers {
  readonly who: WhoLive;
  readonly places: PlaceCount;
}

export type QuoteKind = 'self-host' | 'studio' | 'intro';

export interface QuoteCta {
  readonly label: string;
  readonly href: string;
}

export interface QuoteResult {
  readonly kind: QuoteKind;
  readonly title: string;
  readonly pathLabel?: string;
  readonly lines: readonly string[];
  readonly ownership: readonly string[];
  readonly startFreeCta?: QuoteCta;
  readonly studioCta?: QuoteCta;
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
  places: 'one',
};

const STUDIO_QUOTE_URL = `${SITE.urls.agency}/#calculator`;

export const QUOTE_CALCULATOR = {
  heading: 'Who runs it. What you need. One product price.',
  bodies: {
    home: 'Self-host licenses are the default on RevealUI. For implementation, open the separate RevealUI Studio quote and booking path.',
    pricing:
      'This calculator covers Free, Pro, Max, and Pro Perpetual licenses. For Studio Consultation, Proof Sprint, or Launch, visit revealuistudio.com.',
  },
  questions: {
    who: {
      label: 'Who runs it?',
      options: [
        { id: 'self', label: 'I self-host the runtime' },
        { id: 'studio', label: 'I need Studio implementation' },
      ] as const satisfies readonly QuoteOption<WhoLive>[],
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
  studioPath: {
    label: 'Studio path',
    title: 'RevealUI Studio',
    body: 'Open the separate RevealUI Studio quote. Studio lists Consultation, Proof Sprint, and Launch on its own domain.',
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
  studioCta: {
    label: 'Visit Studio quote',
    href: STUDIO_QUOTE_URL,
  },
  introCta: {
    label: 'Book a 30-minute intro',
    note: 'Google Calendar / Google Meet.',
    href: SITE.urls.bookIntro,
  },
} as const;

export function resolveQuote(answers: QuoteAnswers): QuoteResult {
  const introCta = {
    label: QUOTE_CALCULATOR.introCta.label,
    note: QUOTE_CALCULATOR.introCta.note,
    href: QUOTE_CALCULATOR.introCta.href,
  };
  const ownership = [...QUOTE_CALCULATOR.ownership];

  if (answers.who === 'studio') {
    return {
      kind: 'studio',
      title: QUOTE_CALCULATOR.studioPath.title,
      pathLabel: QUOTE_CALCULATOR.studioPath.label,
      lines: [QUOTE_CALCULATOR.studioPath.body],
      ownership,
      studioCta: {
        label: QUOTE_CALCULATOR.studioCta.label,
        href: QUOTE_CALCULATOR.studioCta.href,
      },
      introCta,
    };
  }

  if (answers.places === 'many') {
    return {
      kind: 'intro',
      title: QUOTE_CALCULATOR.intro.title,
      lines: [QUOTE_CALCULATOR.intro.body],
      ownership,
      introCta,
    };
  }

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
