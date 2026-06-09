---
"@revealui/presentation": minor
---

Animations now honor `prefers-reduced-motion`. A new `useReducedMotion` hook is exported from `@revealui/presentation/animations`, and the `useSpring`, `useAnimation`, `useStagger`, and `usePresence` hooks collapse to their final state (no transition, no stagger, instant mount/unmount) when the user has requested reduced motion. The hook is SSR-safe and reactive to runtime changes.
