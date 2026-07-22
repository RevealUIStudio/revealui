/**
 * Infer which field editor the canvas should open from a data-rvui-field path.
 * Zero authored regex: leaf segment + endsWith checks only.
 */

export type FieldKind = 'text' | 'url' | 'media';

/** Allowlisted design-token CSS variables the theme panel may set (D8). */
export const EDITABLE_THEME_TOKENS = [
  '--rvui-brand',
  '--rvui-brand-glow',
  '--rvui-accent',
  '--rvui-radius-md',
] as const;

export type EditableThemeToken = (typeof EDITABLE_THEME_TOKENS)[number];

export function isEditableThemeToken(name: string): name is EditableThemeToken {
  return (EDITABLE_THEME_TOKENS as readonly string[]).includes(name);
}

/**
 * Leaf of a dotted path (`blocks.2.data.links.0.href` → `href`).
 */
export function fieldPathLeaf(field: string): string {
  const lastDot = field.lastIndexOf('.');
  if (lastDot === -1) return field;
  return field.slice(lastDot + 1);
}

/**
 * Classify a field path for the canvas popover.
 * - media: image/src URLs that should pick from the media library
 * - url: href/link destinations (typed URL, no media library)
 * - text: everything else (prose / labels)
 */
export function fieldKindFromPath(field: string): FieldKind {
  const leaf = fieldPathLeaf(field);
  if (leaf === 'src' || leaf === 'imageSrc' || leaf === 'imageUrl') return 'media';
  if (leaf === 'href' || leaf === 'url' || leaf === 'link') return 'url';
  if (field.endsWith('.src') || field.endsWith('.imageSrc')) return 'media';
  if (field.endsWith('.href')) return 'url';
  return 'text';
}
