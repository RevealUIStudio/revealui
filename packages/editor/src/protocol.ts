/**
 * postMessage protocol shared by the edit-mode runtime (previewed site) and the
 * dashboard canvas. Dependency-free by design: the runtime half ships to the
 * marketing site and must stay tiny and framework-agnostic, so validation here
 * is hand-written type guards, not a schema library.
 *
 * Origin pinning is enforced by the two peers, NOT here: every message is sent
 * with an exact targetOrigin and every received message is dropped unless its
 * `event.origin` equals the peer's configured origin. These guards only assert
 * payload SHAPE once the origin check has already passed.
 */

/** Runtime -> canvas: the runtime has initialized and is listening. */
export const RVUI_READY = 'rvui:ready';
/** Runtime -> canvas: an editable field was clicked in the preview. */
export const RVUI_CLICK = 'rvui:click';
/** Runtime -> canvas: an inbound apply-patch was applied (ack). */
export const RVUI_PATCH_APPLIED = 'rvui:patch-applied';
/** Canvas -> runtime: apply a committed field value optimistically. */
export const RVUI_APPLY_PATCH = 'rvui:apply-patch';
/** Canvas -> runtime: apply allowlisted design-token CSS variables (P2 theming). */
export const RVUI_SET_THEME = 'rvui:set-theme';

export interface FieldRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ReadyMessage {
  type: typeof RVUI_READY;
}

export interface ClickMessage {
  type: typeof RVUI_CLICK;
  /** Document id (data-rvui-doc). */
  doc: string;
  /** Dot-path field address (data-rvui-field), e.g. `blocks.3.title`. */
  field: string;
  /** Viewport rect of the clicked element, for popover placement. */
  rect: FieldRect;
  /** Current text content of the clicked field. */
  currentValue: string;
}

export interface PatchAppliedMessage {
  type: typeof RVUI_PATCH_APPLIED;
  doc: string;
  field: string;
}

export interface ApplyPatchMessage {
  type: typeof RVUI_APPLY_PATCH;
  doc: string;
  field: string;
  value: string;
}

export interface SetThemeMessage {
  type: typeof RVUI_SET_THEME;
  /** CSS custom property map; runtime applies only known --rvui-* keys. */
  tokens: Record<string, string>;
}

export type RuntimeToCanvasMessage = ReadyMessage | ClickMessage | PatchAppliedMessage;
export type CanvasToRuntimeMessage = ApplyPatchMessage | SetThemeMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFieldRect(value: unknown): value is FieldRect {
  return (
    isRecord(value) &&
    typeof value.top === 'number' &&
    typeof value.left === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  );
}

export function isReadyMessage(value: unknown): value is ReadyMessage {
  return isRecord(value) && value.type === RVUI_READY;
}

export function isClickMessage(value: unknown): value is ClickMessage {
  return (
    isRecord(value) &&
    value.type === RVUI_CLICK &&
    typeof value.doc === 'string' &&
    typeof value.field === 'string' &&
    typeof value.currentValue === 'string' &&
    isFieldRect(value.rect)
  );
}

export function isPatchAppliedMessage(value: unknown): value is PatchAppliedMessage {
  return (
    isRecord(value) &&
    value.type === RVUI_PATCH_APPLIED &&
    typeof value.doc === 'string' &&
    typeof value.field === 'string'
  );
}

export function isApplyPatchMessage(value: unknown): value is ApplyPatchMessage {
  return (
    isRecord(value) &&
    value.type === RVUI_APPLY_PATCH &&
    typeof value.doc === 'string' &&
    typeof value.field === 'string' &&
    typeof value.value === 'string'
  );
}

export function isSetThemeMessage(value: unknown): value is SetThemeMessage {
  if (!(isRecord(value) && value.type === RVUI_SET_THEME && isRecord(value.tokens))) {
    return false;
  }
  for (const [key, val] of Object.entries(value.tokens)) {
    if (typeof key !== 'string' || typeof val !== 'string') return false;
  }
  return true;
}

/**
 * Dev-only diagnostic. Guarded so the shipped runtime stays silent in
 * production and takes no logger dependency.
 */
export function devWarn(message: string): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // biome-ignore lint/suspicious/noConsole: dev-only diagnostic; dependency-free package takes no logger dep
    console.warn(`[rvui-editor] ${message}`); // console-allowed
  }
}
