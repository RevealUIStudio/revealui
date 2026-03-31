import { describe, expect, it } from 'vitest';
import { cubicBezier, resolveEasing } from '../core/easing.js';

describe('easing functions', () => {
  describe('standard easings via resolveEasing', () => {
    it('resolves named easing strings', () => {
      const linear = resolveEasing('linear');
      expect(linear(0)).toBe(0);
      expect(linear(0.5)).toBe(0.5);
      expect(linear(1)).toBe(1);
    });

    it('resolves easeIn (cubic)', () => {
      const easeIn = resolveEasing('easeIn');
      expect(easeIn(0)).toBe(0);
      expect(easeIn(1)).toBe(1);
      // cubic easeIn accelerates — midpoint < 0.5
      expect(easeIn(0.5)).toBeLessThan(0.5);
      expect(easeIn(0.5)).toBeCloseTo(0.125, 5); // 0.5^3
    });

    it('resolves easeOut (cubic)', () => {
      const easeOut = resolveEasing('easeOut');
      expect(easeOut(0)).toBe(0);
      expect(easeOut(1)).toBe(1);
      // cubic easeOut decelerates — midpoint > 0.5
      expect(easeOut(0.5)).toBeGreaterThan(0.5);
      expect(easeOut(0.5)).toBeCloseTo(0.875, 5); // 1 - (1-0.5)^3
    });

    it('resolves easeInOut (cubic)', () => {
      const easeInOut = resolveEasing('easeInOut');
      expect(easeInOut(0)).toBe(0);
      expect(easeInOut(0.5)).toBeCloseTo(0.5, 5);
      expect(easeInOut(1)).toBe(1);
      // first half accelerates, second half decelerates
      expect(easeInOut(0.25)).toBeLessThan(0.25);
      expect(easeInOut(0.75)).toBeGreaterThan(0.75);
    });

    it('resolves easeOutBack (overshoot)', () => {
      const easeOutBack = resolveEasing('easeOutBack');
      expect(easeOutBack(0)).toBeCloseTo(0, 5);
      expect(easeOutBack(1)).toBeCloseTo(1, 5);
      // overshoots — some value > 1 during animation
      let hasOvershoot = false;
      for (let t = 0; t <= 1; t += 0.01) {
        if (easeOutBack(t) > 1) hasOvershoot = true;
      }
      expect(hasOvershoot).toBe(true);
    });

    it('resolves easeOutElastic', () => {
      const elastic = resolveEasing('easeOutElastic');
      expect(elastic(0)).toBe(0);
      expect(elastic(1)).toBe(1);
      // oscillates around 1
      expect(elastic(0.5)).toBeGreaterThan(0.9);
    });

    it('resolves easeOutExpo', () => {
      const expo = resolveEasing('easeOutExpo');
      expect(expo(0)).toBeCloseTo(0, 1);
      expect(expo(1)).toBe(1);
      // quickly approaches 1
      expect(expo(0.5)).toBeGreaterThan(0.9);
    });

    it('passes through function easings', () => {
      const custom = (t: number) => t * t;
      expect(resolveEasing(custom)).toBe(custom);
    });

    it('falls back to easeOut for unknown names', () => {
      const fallback = resolveEasing('nonexistent');
      const easeOut = resolveEasing('easeOut');
      expect(fallback(0.5)).toBe(easeOut(0.5));
    });
  });

  describe('cubicBezier', () => {
    it('creates CSS-compatible ease curve', () => {
      // CSS "ease" = cubic-bezier(0.25, 0.1, 0.25, 1.0)
      const ease = cubicBezier(0.25, 0.1, 0.25, 1.0);
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      // decelerating curve — midpoint > 0.5
      expect(ease(0.5)).toBeGreaterThan(0.5);
    });

    it('handles linear as identity', () => {
      const linear = cubicBezier(0, 0, 1, 1);
      for (let t = 0; t <= 1; t += 0.1) {
        expect(linear(t)).toBeCloseTo(t, 2);
      }
    });

    it('clamps boundary values', () => {
      const curve = cubicBezier(0.4, 0, 0.2, 1);
      expect(curve(-0.1)).toBe(0);
      expect(curve(1.5)).toBe(1);
    });

    it('matches rvuiEase preset', () => {
      const rvuiEase = resolveEasing('rvuiEase');
      const manual = cubicBezier(0.22, 1, 0.36, 1);
      expect(rvuiEase(0.5)).toBeCloseTo(manual(0.5), 5);
    });

    it('matches rvuiSpring preset (overshoot)', () => {
      const rvuiSpring = resolveEasing('rvuiSpring');
      expect(rvuiSpring(0)).toBe(0);
      expect(rvuiSpring(1)).toBe(1);
      // y1=1.56 means the curve overshoots
      let hasOvershoot = false;
      for (let t = 0; t <= 1; t += 0.01) {
        if (rvuiSpring(t) > 1) hasOvershoot = true;
      }
      expect(hasOvershoot).toBe(true);
    });

    it('is monotonically increasing for standard curves', () => {
      const ease = cubicBezier(0.25, 0.1, 0.25, 1.0);
      let prev = -1;
      for (let t = 0; t <= 1; t += 0.01) {
        const val = ease(t);
        expect(val).toBeGreaterThanOrEqual(prev);
        prev = val;
      }
    });
  });
});
