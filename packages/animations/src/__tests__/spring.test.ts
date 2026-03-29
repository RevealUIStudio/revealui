import { describe, expect, it } from 'vitest';
import { resolveSpringConfig, SPRING_PRESETS, stepSpring } from '../core/spring.js';

describe('spring physics', () => {
  const DEFAULT_CONFIG = {
    stiffness: 100,
    damping: 10,
    mass: 1,
    restSpeed: 0.01,
    restDelta: 0.01,
  };

  describe('resolveSpringConfig', () => {
    it('returns default config when called with no args', () => {
      expect(resolveSpringConfig()).toEqual(DEFAULT_CONFIG);
    });

    it('returns default config for undefined', () => {
      expect(resolveSpringConfig(undefined)).toEqual(DEFAULT_CONFIG);
    });

    it('resolves named presets', () => {
      const gentle = resolveSpringConfig('gentle');
      expect(gentle.stiffness).toBe(120);
      expect(gentle.damping).toBe(14);
      expect(gentle.mass).toBe(1);
    });

    it('resolves bouncy preset', () => {
      const bouncy = resolveSpringConfig('bouncy');
      expect(bouncy.stiffness).toBe(600);
      expect(bouncy.damping).toBe(15);
    });

    it('resolves molasses preset (heavy mass)', () => {
      const molasses = resolveSpringConfig('molasses');
      expect(molasses.mass).toBe(2);
    });

    it('merges partial config with defaults', () => {
      const config = resolveSpringConfig({ stiffness: 200 });
      expect(config.stiffness).toBe(200);
      expect(config.damping).toBe(DEFAULT_CONFIG.damping);
      expect(config.mass).toBe(DEFAULT_CONFIG.mass);
    });

    it('falls back to default for unknown preset name', () => {
      const config = resolveSpringConfig('nonexistent' as 'default');
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('SPRING_PRESETS', () => {
    it('has all expected presets', () => {
      expect(Object.keys(SPRING_PRESETS)).toEqual(
        expect.arrayContaining(['gentle', 'default', 'bouncy', 'stiff', 'slow', 'molasses']),
      );
    });

    it('all presets have required fields', () => {
      for (const [, preset] of Object.entries(SPRING_PRESETS)) {
        expect(preset).toHaveProperty('stiffness');
        expect(preset).toHaveProperty('damping');
        expect(preset).toHaveProperty('mass');
        expect(preset.stiffness).toBeGreaterThan(0);
        expect(preset.damping).toBeGreaterThan(0);
        expect(preset.mass).toBeGreaterThan(0);
      }
    });
  });

  describe('stepSpring', () => {
    it('moves toward target', () => {
      const result = stepSpring(DEFAULT_CONFIG, 0, 1, 0, 1 / 60);
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBeLessThan(1);
      expect(result.done).toBe(false);
    });

    it('accelerates from rest', () => {
      const result = stepSpring(DEFAULT_CONFIG, 0, 1, 0, 1 / 60);
      expect(result.velocity).toBeGreaterThan(0);
    });

    it('settles to target eventually', () => {
      let value = 0;
      let velocity = 0;
      const dt = 1 / 60;

      for (let i = 0; i < 600; i++) {
        const result = stepSpring(DEFAULT_CONFIG, value, 1, velocity, dt);
        value = result.value;
        velocity = result.velocity;
        if (result.done) {
          expect(value).toBe(1);
          expect(velocity).toBe(0);
          return;
        }
      }
      // Should have settled within 10 seconds
      expect(value).toBeCloseTo(1, 2);
    });

    it('snaps to target when within rest thresholds', () => {
      // Close enough to target with near-zero velocity
      const result = stepSpring(DEFAULT_CONFIG, 0.999, 1, 0.001, 1 / 60);
      expect(result.done).toBe(true);
      expect(result.value).toBe(1);
      expect(result.velocity).toBe(0);
    });

    it('returns done when already at target with zero velocity', () => {
      const result = stepSpring(DEFAULT_CONFIG, 1, 1, 0, 1 / 60);
      expect(result.done).toBe(true);
      expect(result.value).toBe(1);
    });

    it('handles negative targets', () => {
      const result = stepSpring(DEFAULT_CONFIG, 0, -1, 0, 1 / 60);
      expect(result.value).toBeLessThan(0);
    });

    it('bouncy config overshoots', () => {
      const bouncy = resolveSpringConfig('bouncy');
      let value = 0;
      let velocity = 0;
      const dt = 1 / 60;
      let overshot = false;

      for (let i = 0; i < 600; i++) {
        const result = stepSpring(bouncy, value, 1, velocity, dt);
        value = result.value;
        velocity = result.velocity;
        if (value > 1) overshot = true;
        if (result.done) break;
      }
      expect(overshot).toBe(true);
    });

    it('stiff config settles faster than slow', () => {
      const stiff = resolveSpringConfig('stiff');
      const slow = resolveSpringConfig('slow');
      const dt = 1 / 60;

      let stiffFrames = 0;
      let v1 = 0;
      let vel1 = 0;
      for (let i = 0; i < 600; i++) {
        const r = stepSpring(stiff, v1, 1, vel1, dt);
        v1 = r.value;
        vel1 = r.velocity;
        stiffFrames++;
        if (r.done) break;
      }

      let slowFrames = 0;
      let v2 = 0;
      let vel2 = 0;
      for (let i = 0; i < 600; i++) {
        const r = stepSpring(slow, v2, 1, vel2, dt);
        v2 = r.value;
        vel2 = r.velocity;
        slowFrames++;
        if (r.done) break;
      }

      expect(stiffFrames).toBeLessThan(slowFrames);
    });

    it('higher mass increases inertia', () => {
      const light = resolveSpringConfig({ mass: 0.5 });
      const heavy = resolveSpringConfig({ mass: 5 });
      const dt = 1 / 60;

      const r1 = stepSpring(light, 0, 1, 0, dt);
      const r2 = stepSpring(heavy, 0, 1, 0, dt);

      // Light mass moves further in first frame
      expect(r1.value).toBeGreaterThan(r2.value);
    });
  });
});
