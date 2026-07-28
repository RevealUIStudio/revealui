/**
 * @revealui/tokens — typed semantic token API.
 *
 * Each value is a CSS variable reference, not a literal color, because the
 * literal value depends on theme (dark vs light) and the cascade resolves it
 * at render time. The variable names follow the `--rvui-*` namespace declared
 * in `tokens.css` and pinned by `design-context/brand-meta.json`.
 *
 * Parity guard: `src/__tests__/parity.test.ts` parses tokens.css with PostCSS
 * and asserts every `--rvui-*` declared in CSS is referenced here, and every
 * reference here exists in CSS. Drift between the two is a CI failure.
 *
 * The dark-CTA-label caveat (paper-white on cobalt-300 tests 3.97:1 and fails
 * AA; ink on cobalt-300 tests ~4.69:1 and passes) is encoded by keeping
 * `text.onBrand` distinct from `text.0` and `text.warningText` distinct from
 * `status.warning`. The contrast invariants are asserted in
 * `tokens.contract.test.ts`.
 */

export const tokens = {
  brand: {
    base: 'var(--rvui-brand)',
    hover: 'var(--rvui-brand-hover)',
    strong: 'var(--rvui-brand-strong)',
    soft: 'var(--rvui-brand-soft)',
    subtle: 'var(--rvui-brand-subtle)',
    text: 'var(--rvui-brand-text)',
    glow: 'var(--rvui-brand-glow)',
  },
  accent: {
    base: 'var(--rvui-accent)',
    hover: 'var(--rvui-accent-hover)',
    strong: 'var(--rvui-accent-strong)',
    soft: 'var(--rvui-accent-soft)',
    glow: 'var(--rvui-accent-glow)',
  },
  surface: [
    'var(--rvui-surface-0)',
    'var(--rvui-surface-1)',
    'var(--rvui-surface-2)',
    'var(--rvui-surface-3)',
  ] as const,
  text: {
    0: 'var(--rvui-text-0)',
    1: 'var(--rvui-text-1)',
    2: 'var(--rvui-text-2)',
    onBrand: 'var(--rvui-text-on-brand)',
    onAccent: 'var(--rvui-text-on-accent)',
    onSuccess: 'var(--rvui-text-on-success)',
    onWarning: 'var(--rvui-text-on-warning)',
    onError: 'var(--rvui-text-on-error)',
    warningText: 'var(--rvui-warning-text)',
  },
  /** Modal / drawer / alert backdrop (theme-varying opacity). */
  scrim: 'var(--rvui-scrim)',
  border: {
    base: 'var(--rvui-border)',
    subtle: 'var(--rvui-border-subtle)',
    strong: 'var(--rvui-border-strong)',
  },
  radius: {
    sm: 'var(--rvui-radius-sm)',
    md: 'var(--rvui-radius-md)',
    lg: 'var(--rvui-radius-lg)',
    xl: 'var(--rvui-radius-xl)',
    full: 'var(--rvui-radius-full)',
  },
  borderWidth: 'var(--rvui-border-width)',
  motion: {
    ease: 'var(--rvui-ease)',
    easeIn: 'var(--rvui-ease-in)',
    easeOut: 'var(--rvui-ease-out)',
    easeSpring: 'var(--rvui-ease-spring)',
    durationFast: 'var(--rvui-duration-fast)',
    durationNormal: 'var(--rvui-duration-normal)',
    durationSlow: 'var(--rvui-duration-slow)',
  },
  type: {
    fontSans: 'var(--rvui-font-sans)',
    fontMono: 'var(--rvui-font-mono)',
    fontDisplay: 'var(--rvui-font-display)',
    size: {
      xs: 'var(--rvui-text-xs)',
      sm: 'var(--rvui-text-sm)',
      base: 'var(--rvui-text-base)',
      lg: 'var(--rvui-text-lg)',
      xl: 'var(--rvui-text-xl)',
      '2xl': 'var(--rvui-text-2xl)',
      '3xl': 'var(--rvui-text-3xl)',
      display: 'var(--rvui-text-display)',
    },
    leading: {
      tight: 'var(--rvui-leading-tight)',
      normal: 'var(--rvui-leading-normal)',
      relaxed: 'var(--rvui-leading-relaxed)',
    },
    tracking: {
      tight: 'var(--rvui-tracking-tight)',
      normal: 'var(--rvui-tracking-normal)',
      wide: 'var(--rvui-tracking-wide)',
    },
  },
  space: {
    0: 'var(--rvui-space-0)',
    px: 'var(--rvui-space-px)',
    '0_5': 'var(--rvui-space-0-5)',
    1: 'var(--rvui-space-1)',
    '1_5': 'var(--rvui-space-1-5)',
    2: 'var(--rvui-space-2)',
    3: 'var(--rvui-space-3)',
    4: 'var(--rvui-space-4)',
    5: 'var(--rvui-space-5)',
    6: 'var(--rvui-space-6)',
    8: 'var(--rvui-space-8)',
    10: 'var(--rvui-space-10)',
    12: 'var(--rvui-space-12)',
    16: 'var(--rvui-space-16)',
    20: 'var(--rvui-space-20)',
    24: 'var(--rvui-space-24)',
  },
  z: {
    base: 'var(--rvui-z-base)',
    dropdown: 'var(--rvui-z-dropdown)',
    sticky: 'var(--rvui-z-sticky)',
    overlay: 'var(--rvui-z-overlay)',
    modal: 'var(--rvui-z-modal)',
    toast: 'var(--rvui-z-toast)',
  },
  status: {
    success: 'var(--rvui-success)',
    successSubtle: 'var(--rvui-success-subtle)',
    successStrong: 'var(--rvui-success-strong)',
    warning: 'var(--rvui-warning)',
    warningSubtle: 'var(--rvui-warning-subtle)',
    error: 'var(--rvui-error)',
    errorSubtle: 'var(--rvui-error-subtle)',
    info: 'var(--rvui-info)',
    infoSubtle: 'var(--rvui-info-subtle)',
  },
  shadow: {
    sm: 'var(--rvui-shadow-sm)',
    md: 'var(--rvui-shadow-md)',
    lg: 'var(--rvui-shadow-lg)',
    glow: 'var(--rvui-shadow-glow)',
    glowAccent: 'var(--rvui-shadow-glow-accent)',
  },
} as const;

export type Tokens = typeof tokens;
