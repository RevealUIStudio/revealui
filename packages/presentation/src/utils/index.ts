export { cn } from './cn.js';
export {
  INTENTS,
  type Intent,
  LEGACY_COLOR_TO_INTENT,
  type LegacyColorway,
  resolveIntent,
} from './intent.js';
// focusRing* stay internal — import from './focus.js' inside the package only.
// Guarded by src/__tests__/api-surface.test.ts ("keeps the focus-ring constants internal").
