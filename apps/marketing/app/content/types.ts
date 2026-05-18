// Shared content types for marketing/app/content/*
// Sourced from extraction of inline JSX content per
// docs/lanes/marketing-overhaul/plan.md §4.4 (Phase 1).

export interface Cta {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface NavLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export interface SectionHeading {
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
}
