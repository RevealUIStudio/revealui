/**
 * Rich Text Editor Adapter
 * @module @revealui/core/admin/RichText
 */

export interface RichTextAdapter {
  name: string;
  features?: unknown[];
  serialize?: (content: unknown) => string;
  deserialize?: (content: string) => unknown;
}

export type { RichTextAdapter as default };
