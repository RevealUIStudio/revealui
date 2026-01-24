import type { LexicalNode } from "lexical";
import type React from "react";
import { useEffect } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type BaseEditor = LexicalNode & {
	shouldBreakOutOnEnter?: (element: any) => boolean;
};

interface LargeBodyPluginProps {
	editor: BaseEditor;
}

const LargeBodyPlugin: React.FC<LargeBodyPluginProps> = ({ editor }) => {
	useEffect(() => {
		const originalShouldBreakOutOnEnter = editor.shouldBreakOutOnEnter;

		editor.shouldBreakOutOnEnter = (element) =>
			element.type === "large-body"
				? true
				: originalShouldBreakOutOnEnter
					? originalShouldBreakOutOnEnter(element)
					: false;

		// Cleanup function to revert to the original function
		return () => {
			editor.shouldBreakOutOnEnter = originalShouldBreakOutOnEnter;
		};
	}, [editor]);

	return null; // This component doesn't render anything, it just modifies the editor behavior
};

export default LargeBodyPlugin;

// /* eslint-disable @typescript-eslint/no-explicit-any */
// type BaseEditor = {
//   shouldBreakOutOnEnter?: (element: any) => boolean
// }

// const LargeBodyPlugin = async (
//   incomingEditor: BaseEditor & {
//     shouldBreakOutOnEnter?: ((element: any) => boolean) | undefined
//   }
// ) => {
//   const editor: BaseEditor & {
//     shouldBreakOutOnEnter?: (element: any) => boolean
//   } = incomingEditor

//   const { shouldBreakOutOnEnter } = editor

//   if (shouldBreakOutOnEnter) {
//     editor.shouldBreakOutOnEnter = (element) =>
//       element.type === 'large-body' ? true : shouldBreakOutOnEnter(element)
//   }

//   return editor
// }

// export default LargeBodyPlugin
// const withLargeBody: RichTextPlugin = (incomingEditor) => {
//   const editor: BaseEditor & {
//     shouldBreakOutOnEnter?: (element: any) => boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
//   } = incomingEditor;

//   const { shouldBreakOutOnEnter } = editor;

//   if (shouldBreakOutOnEnter) {
//     editor.shouldBreakOutOnEnter = (element) =>
//       element.type === "large-body" ? true : shouldBreakOutOnEnter(element);
//   }

//   return editor;
// };

// export default withLargeBody;
