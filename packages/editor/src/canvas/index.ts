/**
 * @revealui/editor/canvas  -  dashboard-side visual editor (Client Components).
 *
 * Mount `EditSessionCanvas` from a `'use client'` boundary. Built from
 * @revealui/presentation primitives; takes no `next/*` dependency.
 */
export {
  EditSessionCanvas,
  type EditSessionCanvasProps,
  type Fetcher,
  pickDefaultPreviewPageId,
} from './EditSessionCanvas.js';
export {
  EDITABLE_THEME_TOKENS,
  type EditableThemeToken,
  type FieldKind,
  fieldKindFromPath,
  fieldPathLeaf,
  isEditableThemeToken,
} from './field-kind.js';
