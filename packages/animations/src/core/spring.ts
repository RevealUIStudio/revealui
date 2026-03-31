/**
 * Spring physics solver.
 *
 * Solves the damped harmonic oscillator equation each frame:
 *   F = -k*x - c*v
 *   a = F / m
 *   v += a * dt
 *   x += v * dt
 *
 * Where:
 *   k = stiffness (spring constant)
 *   c = damping coefficient
 *   m = mass
 *   x = displacement from target
 *   v = velocity
 */

export interface SpringConfig {
  /** Spring stiffness (default: 100). Higher = faster/snappier */
  stiffness: number;
  /** Damping coefficient (default: 10). Higher = less oscillation */
  damping: number;
  /** Mass (default: 1). Higher = more inertia */
  mass: number;
  /** Velocity threshold for settling (default: 0.01) */
  restSpeed: number;
  /** Position threshold for settling (default: 0.01) */
  restDelta: number;
}

export interface SpringState {
  /** Current position */
  value: number;
  /** Current velocity */
  velocity: number;
  /** Whether the spring has settled */
  done: boolean;
}

export const DEFAULT_SPRING: SpringConfig = {
  stiffness: 100,
  damping: 10,
  mass: 1,
  restSpeed: 0.01,
  restDelta: 0.01,
};

/** Spring presets for common animation feels */
export const SPRING_PRESETS = {
  /** Gentle, no bounce */
  gentle: { stiffness: 120, damping: 14, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
  /** Default, slight bounce */
  default: { stiffness: 100, damping: 10, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
  /** Snappy with noticeable bounce */
  bouncy: { stiffness: 600, damping: 15, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
  /** Very stiff, minimal oscillation */
  stiff: { stiffness: 300, damping: 20, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
  /** Slow and elastic */
  slow: { stiffness: 50, damping: 8, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
  /** Molasses — heavy and slow */
  molasses: { stiffness: 40, damping: 15, mass: 2, restSpeed: 0.01, restDelta: 0.01 },
} as const satisfies Record<string, SpringConfig>;

export type SpringPreset = keyof typeof SPRING_PRESETS;

/**
 * Step the spring simulation forward by dt seconds.
 * Returns new state (position, velocity, done).
 */
export function stepSpring(
  config: SpringConfig,
  current: number,
  target: number,
  velocity: number,
  dt: number,
): SpringState {
  const { stiffness, damping, mass, restSpeed, restDelta } = config;

  // Displacement from target
  const displacement = current - target;

  // Force = -kx - cv (Hooke's law + damping)
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * velocity;
  const totalForce = springForce + dampingForce;

  // Acceleration = F / m
  const acceleration = totalForce / mass;

  // Semi-implicit Euler integration (more stable than explicit)
  const newVelocity = velocity + acceleration * dt;
  const newValue = current + newVelocity * dt;

  // Check if spring has settled
  const isResting = Math.abs(newVelocity) < restSpeed && Math.abs(newValue - target) < restDelta;

  return {
    value: isResting ? target : newValue,
    velocity: isResting ? 0 : newVelocity,
    done: isResting,
  };
}

/**
 * Resolve a spring config from a preset name or partial config.
 */
export function resolveSpringConfig(config?: Partial<SpringConfig> | SpringPreset): SpringConfig {
  if (typeof config === 'string') {
    return SPRING_PRESETS[config] ?? DEFAULT_SPRING;
  }
  return { ...DEFAULT_SPRING, ...config };
}
