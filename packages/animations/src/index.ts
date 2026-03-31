// Core

export type { EasingFunction } from './core/easing.js';
export { cubicBezier, resolveEasing } from './core/easing.js';
export { onFrame } from './core/frame-loop.js';
export type { SpringConfig, SpringPreset } from './core/spring.js';
export {
  resolveSpringConfig,
  SPRING_PRESETS,
  stepSpring,
} from './core/spring.js';
export type { AnimationConfig, AnimationTarget } from './hooks/use-animation.js';
// Hooks
export { useAnimation } from './hooks/use-animation.js';
export type { GestureHandlers } from './hooks/use-gesture.js';
export { useGesture } from './hooks/use-gesture.js';

export { usePresence } from './hooks/use-presence.js';

export { useSpring } from './hooks/use-spring.js';
export type { StaggerConfig } from './hooks/use-stagger.js';
export { useStagger } from './hooks/use-stagger.js';
