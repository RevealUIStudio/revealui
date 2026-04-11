/**
 * Easing functions for animations.
 *
 * All functions take a progress value t (0..1) and return an eased value (0..1).
 * Custom cubic-bezier is solved numerically using Newton-Raphson.
 */

export type EasingFunction = (t: number) => number;

// ---------------------------------------------------------------------------
// Standard easings
// ---------------------------------------------------------------------------

export const linear: EasingFunction = (t) => t;

export const easeIn: EasingFunction = (t) => t * t * t;

export const easeOut: EasingFunction = (t) => 1 - (1 - t) ** 3;

export const easeInOut: EasingFunction = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Overshoot ease-out (matches --rvui-ease-spring) */
export const easeOutBack: EasingFunction = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** Elastic bounce at the end */
export const easeOutElastic: EasingFunction = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Exponential ease-out */
export const easeOutExpo: EasingFunction = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

// ---------------------------------------------------------------------------
// Cubic bezier
// ---------------------------------------------------------------------------

/**
 * Create a cubic-bezier easing function.
 * Matches CSS `cubic-bezier(x1, y1, x2, y2)`.
 *
 * Uses Newton-Raphson iteration for t→x mapping.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  // Pre-computed coefficients for the bezier polynomial
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleX(t: number): number {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleY(t: number): number {
    return ((ay * t + by) * t + cy) * t;
  }

  function sampleDerivX(t: number): number {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  /** Solve for t given x using Newton-Raphson */
  function solveCurveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentX = sampleX(t) - x;
      if (Math.abs(currentX) < 1e-7) return t;
      const deriv = sampleDerivX(t);
      if (Math.abs(deriv) < 1e-7) break;
      t -= currentX / deriv;
    }
    return t;
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveCurveX(x));
  };
}

// ---------------------------------------------------------------------------
// Named presets (matching tokens.css)
// ---------------------------------------------------------------------------

/** Default ease  -  matches --rvui-ease */
export const rvuiEase = cubicBezier(0.22, 1, 0.36, 1);

/** Spring ease  -  matches --rvui-ease-spring */
export const rvuiSpring = cubicBezier(0.34, 1.56, 0.64, 1);

/** Ease in  -  matches --rvui-ease-in */
export const rvuiEaseIn = cubicBezier(0.55, 0, 1, 0.45);

/** Ease out  -  matches --rvui-ease-out */
export const rvuiEaseOut = cubicBezier(0, 0.55, 0.45, 1);

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

const NAMED_EASINGS: Record<string, EasingFunction> = {
  linear,
  easeIn,
  easeOut,
  easeInOut,
  easeOutBack,
  easeOutElastic,
  easeOutExpo,
  rvuiEase,
  rvuiSpring,
  rvuiEaseIn,
  rvuiEaseOut,
};

/** Resolve an easing by name or return the function directly */
export function resolveEasing(easing: string | EasingFunction): EasingFunction {
  if (typeof easing === 'function') return easing;
  return NAMED_EASINGS[easing] ?? easeOut;
}
