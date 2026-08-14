/**
 * Semantic intent — shared by Button, Switch, Radio, Checkbox, Progress, Badge.
 *
 * Gate 0 collapses the Catalyst 11-colorway `color` prop onto these five
 * values so form controls theme with `--rvui-*` instead of Tailwind swatches.
 * See design-system/remediation/gate-0-1/SEMANTIC-INTENTS.md.
 */

export type Intent = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

export const INTENTS: readonly Intent[] = [
  'brand',
  'neutral',
  'success',
  'warning',
  'danger',
] as const;

/** Legacy Catalyst colorway names still accepted via the deprecated `color` prop. */
export type LegacyColorway =
  | 'dark/zinc'
  | 'dark/white'
  | 'dark'
  | 'zinc'
  | 'white'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

/**
 * Maps a Catalyst colorway name to a semantic intent.
 * Kept for the two-minor deprecation window (through 0.15).
 */
export const LEGACY_COLOR_TO_INTENT: Record<LegacyColorway, Intent> = {
  'dark/zinc': 'neutral',
  'dark/white': 'neutral',
  dark: 'neutral',
  zinc: 'neutral',
  white: 'neutral',
  red: 'danger',
  rose: 'danger',
  pink: 'danger',
  orange: 'warning',
  amber: 'warning',
  yellow: 'warning',
  lime: 'success',
  green: 'success',
  emerald: 'success',
  teal: 'success',
  cyan: 'brand',
  sky: 'brand',
  blue: 'brand',
  indigo: 'brand',
  violet: 'brand',
  purple: 'brand',
  fuchsia: 'brand',
};

const warned = new Set<string>();

/**
 * Resolve the effective intent for a control that still accepts the deprecated
 * `color` prop. Emits a one-shot dev warning per component name per session.
 */
export function resolveIntent(opts: {
  intent?: Intent;
  color?: string;
  component: string;
  defaultIntent?: Intent;
}): Intent {
  const fallback = opts.defaultIntent ?? 'brand';
  if (opts.intent) return opts.intent;
  if (opts.color) {
    const mapped = LEGACY_COLOR_TO_INTENT[opts.color as LegacyColorway];
    if (process.env.NODE_ENV !== 'production') {
      const key = `${opts.component}:${opts.color}`;
      if (!warned.has(key)) {
        warned.add(key);
        const next = mapped ?? fallback;
        const msg =
          `[RevealUI] ${opts.component}: the \`color\` prop is deprecated and will be removed in 0.15. ` +
          `Use \`intent\` instead: color="${opts.color}" → intent="${next}". See ` +
          `https://docs.revealui.com/migrations/semantic-intents`;
        // biome-ignore lint/suspicious/noConsole: intentional one-shot deprecation surface through 0.15
        console.warn(msg); // console-allowed
      }
    }
    return mapped ?? fallback;
  }
  return fallback;
}
