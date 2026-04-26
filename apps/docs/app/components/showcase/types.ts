import type React from 'react';

/** Describes a single interactive control for a component prop */
export type PropControl =
  | { type: 'select'; options: string[]; default: string }
  | { type: 'boolean'; default: boolean }
  | { type: 'text'; default: string; placeholder?: string }
  | { type: 'number'; default: number; min?: number; max?: number; step?: number }
  | { type: 'range'; default: number; min: number; max: number; step?: number }
  | { type: 'color'; options: string[]; default: string };

export type PropControls = Record<string, PropControl>;

/** Extract default values from controls into a props object */
export type DefaultProps<T extends PropControls> = {
  [K in keyof T]: T[K]['default'];
};

/** A named example showing a specific component configuration */
export interface ShowcaseExample {
  name: string;
  description?: string;
  render: () => React.ReactNode;
}

/**
 * Accessibility notes for a component. All fields optional; rendered as a
 * collapsed-by-default section on the showcase page when any field is set.
 */
export interface ShowcaseAccessibility {
  /** WCAG criteria explicitly covered, e.g. ["WCAG 2.1 AA contrast", "WCAG 2.1.1 Keyboard"] */
  conformance?: string[];
  /** Keyboard interactions, keyed by key name. e.g. {"Tab": "Move focus to next item"} */
  keyboard?: Record<string, string>;
  /** ARIA attributes the component renders or expects. */
  aria?: Record<string, string>;
  /** Free-form notes (e.g. "use aria-label when no visible label") */
  notes?: string;
}

/**
 * Cross-link to a related showcase by slug. Rendered as a "See also" strip.
 */
export interface ShowcaseRelated {
  slug: string;
  reason?: string;
}

/** Complete showcase definition for a single component */
export interface ShowcaseStory {
  /** URL slug: /showcase/{slug} */
  slug: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Sidebar grouping */
  category: 'component' | 'primitive' | 'hook' | 'token';
  /** Interactive prop controls */
  controls: PropControls;
  /** Render the component with current prop values */
  render: (props: Record<string, unknown>) => React.ReactNode;
  /** Variant grid axes  -  each key is a prop name, value is array of values to iterate */
  variantGrid?: Record<string, string[]>;
  /** Static examples shown below the interactive preview */
  examples?: ShowcaseExample[];
  /** Custom code generator  -  receives current props, returns JSX string */
  code?: (props: Record<string, unknown>) => string;
  /**
   * When-to-use / when-not-to-use guidance. Markdown supported.
   * Rendered above the interactive preview when present.
   */
  usage?: {
    /** Markdown body explaining when to reach for this component. */
    when?: string;
    /** Markdown body explaining when NOT to use it (alternatives, anti-patterns). */
    avoid?: string;
  };
  /**
   * `npm install` snippet shown at the top of the page. Defaults to
   * `npm install @revealui/presentation` when omitted; override only if the
   * component is shipped from a different package or needs extra peerDeps.
   */
  install?: string;
  /**
   * Path inside the @revealui/presentation package to the component source,
   * e.g. "src/components/Button.tsx". Renders a "View source" link to GitHub.
   */
  sourceUrl?: string;
  /** Accessibility notes; rendered when any field is set. */
  a11y?: ShowcaseAccessibility;
  /** "See also" cross-links to related showcases. */
  related?: ShowcaseRelated[];
}

/** Registry entry for lazy-loading stories */
export interface ShowcaseEntry {
  slug: string;
  name: string;
  category: ShowcaseStory['category'];
  loader: () => Promise<{ default: ShowcaseStory }>;
}
