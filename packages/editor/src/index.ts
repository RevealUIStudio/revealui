/**
 * @revealui/editor  -  visual edit-session runtime and dashboard canvas.
 *
 * Two entrypoints carry the actual implementations:
 *   - `@revealui/editor/runtime`  -  dependency-free, loaded by the previewed site
 *   - `@revealui/editor/canvas`   -  React Client Components, mounted in the dashboard
 *
 * The root entry re-exports the shared postMessage protocol (types + guards) so
 * either side can import the contract without pulling in the other half.
 */

export {
  type ApplyPatchMessage,
  type CanvasToRuntimeMessage,
  type ClickMessage,
  type FieldRect,
  isApplyPatchMessage,
  isClickMessage,
  isPatchAppliedMessage,
  isReadyMessage,
  type PatchAppliedMessage,
  type ReadyMessage,
  type RuntimeToCanvasMessage,
  RVUI_APPLY_PATCH,
  RVUI_CLICK,
  RVUI_PATCH_APPLIED,
  RVUI_READY,
} from './protocol.js';
