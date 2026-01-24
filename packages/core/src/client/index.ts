/**
 * RevealUI Client-Side Exports
 *
 * All client-side React components, hooks, and utilities
 */

// Admin components and utilities
export * from "./admin/index.js";
// React hooks
export { useRevealUI, withRevealUIAccess } from "./hooks.js";
// HTTP fetch utilities
export * from "./http/index.js";
// Rich text editor (client components)
// NOTE: RichTextEditor component conflicts with RichTextEditor type from core/types
// Use explicit exports to avoid ambiguity - consumers should import from richtext/client directly
export type {
	FloatingToolbarPluginProps,
	ImageNodeData,
	RichTextEditorProps,
	SerializedImageNode,
	ToolbarPluginProps,
} from "./richtext/index.js";
// Re-export specific items that don't conflict
export {
	$createImageNode,
	$isImageNode,
	FloatingToolbarPlugin,
	ImageNode,
	ImageNodeComponent,
	ImagePlugin,
	ImageUploadButton,
	INSERT_IMAGE_COMMAND,
	OPEN_IMAGE_UPLOAD_COMMAND,
	richTextEditorStyles,
	ToolbarPlugin,
} from "./richtext/index.js";
// UI components
export * from "./ui/index.js";
