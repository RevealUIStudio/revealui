/**
 * RevealUI Rich Text Types
 *
 * Defines rich text editor interfaces.
 *
 * @module @revealui/core/types/richtext
 */
export interface RichTextFeature {
    name: string;
    key: string;
    type: 'mark' | 'inline' | 'block' | 'toolbar' | 'utility';
    tag?: string;
    position?: string;
    options?: Record<string, unknown>;
}
export interface RichTextEditor {
    editorType?: string;
    features: RichTextFeature[];
    outputFormat?: 'html' | 'json' | 'markdown';
    sanitize?: boolean;
    validate?: boolean;
}
//# sourceMappingURL=richtext.d.ts.map