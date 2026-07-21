/**
 * Edit-mode annotation contract for the shared block renderer.
 *
 * When a page is rendered `editable` with a `docId`, every text-bearing element
 * carries two data attributes the edit-mode runtime (a later slice) reads:
 *   - `data-rvui-doc`   — the document id the block array belongs to
 *   - `data-rvui-field` — a dot-path addressing the field inside the block's
 *                          `data` object, e.g. `blocks.3.data.title` or
 *                          `blocks.3.data.items.2.body`.
 *
 * When not editable (or no docId), no data attributes are emitted at all.
 */

/** Render-time annotation state threaded down to every block component. */
export interface BlockAnnotation {
  /** Document id the block array belongs to. */
  docId?: string;
  /** Whether to emit edit-mode data attributes. */
  editable?: boolean;
}

/** The attribute bag spread onto a text-bearing element. Empty when inactive. */
export type AnnotationAttrs = Record<string, string>;

/**
 * Builds the `data-rvui-*` attribute bag for a single field. Returns an empty
 * object (emitting nothing) unless annotation is active with a docId.
 */
export function fieldAttrs(annotation: BlockAnnotation, fieldPath: string): AnnotationAttrs {
  if (annotation.editable && annotation.docId) {
    return { 'data-rvui-doc': annotation.docId, 'data-rvui-field': fieldPath };
  }
  return {};
}

/**
 * Emits a diagnostic in non-production builds only. Kept local so the framework
 * pure package takes no logger dependency; guarded so production stays silent.
 */
export function devWarn(message: string): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // biome-ignore lint/suspicious/noConsole: dev-only diagnostic; framework-pure package takes no logger dep
    console.warn(`[RenderBlocks] ${message}`); // console-allowed
  }
}
