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
}

/** Registry entry for lazy-loading stories */
export interface ShowcaseEntry {
  slug: string;
  name: string;
  category: ShowcaseStory['category'];
  loader: () => Promise<{ default: ShowcaseStory }>;
}
