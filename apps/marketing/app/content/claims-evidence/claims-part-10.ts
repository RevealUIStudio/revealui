import {
  APIFY_PPE_PRICES,
  CLI_CREATE,
  CLI_TEMPLATE_DIRS,
  CLI_TEMPLATE_REGISTRY,
  CREATE_REVEALUI_PKG,
  TEMPLATES_APIFY_TEST,
  TEMPLATES_GITHUB_TEST,
  TEMPLATES_PAGE_TEST,
  VERCEL_ONE_CLICK_TEMPLATE,
  VERCEL_ONE_CLICK_TEST,
} from './shared-refs.js';
import type { ClaimEntry } from './types.js';

export const claimsPart10: readonly ClaimEntry[] = [
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_HERO.subtitle',
    proofGrade: 'outcome',
    text: 'Scaffold a RevealUI app from the published CLI, or start from a GitHub template.',
    evidence: [CLI_CREATE, CLI_TEMPLATE_DIRS, TEMPLATES_PAGE_TEST],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_CLI.body',
    proofGrade: 'outcome',
    match: 'path',
    text: 'Run npx create-revealui@latest. The published npm package is create-revealui 0.5.22.',
    evidence: [CLI_CREATE, CREATE_REVEALUI_PKG, TEMPLATES_PAGE_TEST],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_CLI_ITEMS[1].stack',
    proofGrade: 'path',
    text: 'Next.js 16 + @revealui/* + Stripe',
    evidence: [CLI_TEMPLATE_REGISTRY, CLI_TEMPLATE_DIRS],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_CLI_ITEMS[1].body',
    proofGrade: 'path',
    text: 'Product catalog with checkout.',
    evidence: [CLI_TEMPLATE_REGISTRY],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_CLI_ITEMS[3].body',
    proofGrade: 'path',
    text: 'Blank-canvas Next.js app, no sample collections.',
    evidence: [CLI_TEMPLATE_REGISTRY],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_CLI_ITEMS[4].stack',
    proofGrade: 'outcome',
    text: 'Vite + @revealui/router, no Next.js',
    evidence: [CLI_TEMPLATE_REGISTRY, TEMPLATES_PAGE_TEST],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_CLI_ITEMS[4].body',
    proofGrade: 'outcome',
    text: 'RevealUI-native runtime. No GitHub Use this template twin.',
    evidence: [CLI_TEMPLATE_REGISTRY, TEMPLATES_GITHUB_TEST],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_GITHUB.body',
    proofGrade: 'outcome',
    text: 'Four Next.js templates have a public GitHub twin. starter-native does not.',
    evidence: [TEMPLATES_GITHUB_TEST, CLI_TEMPLATE_DIRS],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_VERCEL.body',
    proofGrade: 'outcome',
    text: 'Clone the starter onto your Vercel account. RevealUI runtime on Vercel and Neon you control. Not managed hosting. Not the Starter Kit. Not a studio invoice.',
    evidence: [VERCEL_ONE_CLICK_TEMPLATE, VERCEL_ONE_CLICK_TEST],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_VERCEL.sourceLabel',
    proofGrade: 'outcome',
    text: 'Open the starter GitHub twin',
    evidence: [
      {
        kind: 'url',
        ref: 'https://github.com/RevealUIStudio/revealui-template-starter',
        note: 'existing create-revealui starter twin',
      },
      VERCEL_ONE_CLICK_TEST,
    ],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_APIFY.body',
    proofGrade: 'outcome',
    text: 'Pay-per-event pricing is $0.02 per action, $0.08 per run, and $0.00001 per verify. Verify is not free.',
    evidence: [APIFY_PPE_PRICES, TEMPLATES_APIFY_TEST],
  },
  {
    file: 'templates.ts',
    exportPath: 'TEMPLATES_LICENSES.body',
    proofGrade: 'outcome',
    text: 'Product licenses live on this site. Studio work is booked on Google Calendar.',
    evidence: [
      {
        kind: 'code',
        ref: 'apps/marketing/app/content/pricing.ts',
        note: 'product license catalog on /pricing',
      },
      {
        kind: 'url',
        ref: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ21UZVcuYp7yO32rZmhyUvZFDJcvles81E9edGNFwSUP8SHEVzGvq0gKgNFo7q04YS5i-12ZE5P',
        note: 'Google Calendar intro booking',
      },
    ],
  },
];
