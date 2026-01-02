/**
 * RevealUI Rich Text Types
 * 
 * Defines rich text editor interfaces.
 * 
 * @module @revealui/cms/types/richtext
 */

// =============================================================================
// RICH TEXT
// =============================================================================

export interface RichTextFeature {
  name: string;
  key: string;
  type: 'mark' | 'inline' | 'block';
  tag?: string;
  options?: Record<string, unknown>;
}

export interface RichTextEditor {
  features: RichTextFeature[];
}
