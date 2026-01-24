"use client";
import {
	$insertNodeToNearestRoot,
	mergeRegister,
	type PluginComponent,
	useLexicalComposerContext,
} from "@revealui/core/richtext/client";
import { FieldsDrawer, useModal } from "@revealui/core/ui";
import {
	$getNodeByKey,
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_EDITOR,
	type RangeSelection,
} from "lexical";
import { useEffect, useState } from "react";
import {
	$createLabelNode,
	INSERT_LABEL_COMMAND,
	type LabelNode,
	type LabelNodeData,
	OPEN_LABEL_DRAWER_COMMAND,
} from "../nodes/LabelNode";

const drawerSlug = "lexical-Label-create";

export const LabelPlugin: PluginComponent = () => {
	const [editor] = useLexicalComposerContext();
	const { closeModal, toggleModal } = useModal();
	const [lastSelection, setLastSelection] = useState<RangeSelection | null>(
		null,
	);
	const [labelData, setLabelData] = useState<LabelNodeData>({ url: "" }); // Initialize with a default structure
	const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null);

	useEffect(() => {
		return mergeRegister(
			editor.registerCommand(
				INSERT_LABEL_COMMAND,
				({ url }: { url: string }) => {
					if (targetNodeKey) {
						const node = $getNodeByKey(targetNodeKey) as LabelNode | null;
						if (node) {
							node.setData({ url });
							setTargetNodeKey(null);
							return true;
						}
					}

					const selection = $getSelection();

					if ($isRangeSelection(selection)) {
						const focusNode = selection.focus.getNode();
						if (focusNode) {
							const labelNode = $createLabelNode({ url });
							$insertNodeToNearestRoot(labelNode);
							return true;
						}
					} else if (lastSelection && $isRangeSelection(lastSelection)) {
						const labelNode = $createLabelNode({ url });
						$insertNodeToNearestRoot(labelNode);
						return true;
					}

					return false;
				},
				COMMAND_PRIORITY_EDITOR,
			),
			editor.registerCommand(
				OPEN_LABEL_DRAWER_COMMAND,
				(labelData: { data?: LabelNodeData; nodeKey?: string }) => {
					setLabelData(labelData?.data ?? { url: "" }); // Ensure the data structure matches LabelNodeData
					setTargetNodeKey(labelData?.nodeKey ?? null);

					if (labelData?.nodeKey) {
						toggleModal(drawerSlug);
						return true;
					}

					editor.getEditorState().read(() => {
						const selection = $getSelection();
						if ($isRangeSelection(selection)) {
							setLastSelection(selection);
							toggleModal(drawerSlug);
						}
					});

					return true;
				},
				COMMAND_PRIORITY_EDITOR,
			),
		);
	}, [editor, lastSelection, targetNodeKey, toggleModal]);

	return (
		<FieldsDrawer
			data={labelData}
			drawerSlug={drawerSlug}
			drawerTitle="Create Label"
			schemaPath="label.fields"
			featureKey="label"
			handleDrawerSubmit={(_fields, data) => {
				closeModal(drawerSlug);
				if (data.url) {
					editor.dispatchCommand(INSERT_LABEL_COMMAND, {
						url: data.url as string,
					});
				}
			}}
			schemaPathSuffix="fields"
		/>
	);
};

// 'use client'
// import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
// import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils'
// import {
//   $getNodeByKey,
//   $getSelection,
//   $isRangeSelection,
//   COMMAND_PRIORITY_EDITOR,
//   RangeSelection
// } from 'lexical'
// import { useEffect, useState } from 'react'
// // TODO: Implement local rich text feature
// TODO: Implement local alternative
// import // @revealui/core/richtext'
// // TODO: Implement local rich text feature
// TODO: Implement local alternative
// import // @revealui/core/richtext/client'
// // TODO: Implement local UI components
// TODO: Implement local alternative
// import // @revealui/core'
// import {
//   LabelNodeData,
//   INSERT_LABEL_COMMAND,
//   LabelNode,
//   $createLabelNode,
//   OPEN_LABEL_DRAWER_COMMAND
// } from '../nodes/LabelNode'

// const drawerSlug = 'lexical-Label-create'

// export const LabelPlugin: PluginComponent = () => {
//   const [editor] = useLexicalComposerContext()
//   const { closeModal, toggleModal } = useModal()
//   const [lastSelection, setLastSelection] = useState<RangeSelection | null>(
//     null
//   )
//   // const [labelData, setLabelData] = useState<LabelNodeData | {}>({})
//   const [labelData, setLabelData] = useState<LabelNodeData>({ url: '' })
//   const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null)

//   useEffect(() => {
//     return mergeRegister(
//       editor.registerCommand(
//         INSERT_LABEL_COMMAND,
//         ({ url }) => {
//           if (targetNodeKey) {
//             const node = $getNodeByKey(targetNodeKey) as LabelNode
//             if (!node) {
//               return false
//             }
//             node.setData({ url })
//             setTargetNodeKey(null)
//             return true
//           }

//           let selection = $getSelection()

//           if (!$isRangeSelection(selection)) {
//             selection = lastSelection
//             if (!$isRangeSelection(selection)) {
//               return false
//             }
//           }

//           const focusNode = selection.focus.getNode()

//           if (focusNode) {
//             const labelNode = $createLabelNode({ url })
//             $insertNodeToNearestRoot(labelNode)
//           }

//           return true
//         },
//         COMMAND_PRIORITY_EDITOR
//       ),
//       editor.registerCommand(
//         OPEN_LABEL_DRAWER_COMMAND,
//         (labelData) => {
//           setLabelData(labelData?.data ?? {})
//           setTargetNodeKey(labelData?.nodeKey ?? null)

//           if (labelData?.nodeKey) {
//             toggleModal(drawerSlug)
//             return true
//           }

//           let rangeSelection: RangeSelection | null = null

//           editor.getEditorState().read(() => {
//             const selection = $getSelection()
//             if ($isRangeSelection(selection)) {
//               rangeSelection = selection
//             }
//           })

//           if (rangeSelection) {
//             setLastSelection(rangeSelection)
//             toggleModal(drawerSlug)
//           }
//           return true
//         },
//         COMMAND_PRIORITY_EDITOR
//       )
//     )
//   }, [editor, lastSelection, targetNodeKey, toggleModal])

//   return (
//     <FieldsDrawer
//       data={labelData}
//       drawerSlug={drawerSlug}
//       drawerTitle={'Create Label'}
//       featureKey="label"
//       handleDrawerSubmit={(_fields, data) => {
//         closeModal(drawerSlug)
//         if (!data.url) {
//           return
//         }

//         editor.dispatchCommand(INSERT_LABEL_COMMAND, {
//           url: data.url as string
//         })
//       }}
//       schemaPathSuffix="fields"
//     />
//   )
// }

// /* eslint-disable @typescript-eslint/ban-types */
// 'use client'

// import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
// import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils'
// import {
//   $getNodeByKey,
//   $getSelection,
//   $isRangeSelection,
//   COMMAND_PRIORITY_EDITOR,
//   RangeSelection
// } from 'lexical'
// import { useEffect, useState } from 'react'
// // TODO: Implement local rich text feature
// TODO: Implement local alternative
// import // @revealui/core/richtext'

// // TODO: Implement local rich text feature
// TODO: Implement local alternative
// import // @revealui/core/richtext/client'
// // TODO: Implement local UI components
// TODO: Implement local alternative
// import // @revealui/core'
// import {
//   LabelNodeData,
//   INSERT_LABEL_COMMAND,
//   LabelNode,
//   $createLabelNode,
//   OPEN_LABEL_DRAWER_COMMAND
// } from '../nodes/LabelNode'

// const drawerSlug = 'lexical-Label-create'

// export const LabelPlugin: PluginComponent = () => {
//   const [editor] = useLexicalComposerContext()
//   const { closeModal, toggleModal } = useModal()
//   const [lastSelection, setLastSelection] = useState<RangeSelection | null>()
//   const [labelData, setLabelData] = useState<LabelNodeData>({} as LabelNodeData)
//   const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null)

//   useEffect(() => {
//     return mergeRegister(
//       editor.registerCommand(
//         INSERT_LABEL_COMMAND,
//         ({ url }) => {
//           if (targetNodeKey) {
//             // Replace existing label node
//             const node: LabelNode = $getNodeByKey(targetNodeKey) as LabelNode
//             if (!node) {
//               return false
//             }
//             node.setData({ url })

//             setTargetNodeKey(null)
//             return true
//           }

//           let selection = $getSelection()

//           if (!$isRangeSelection(selection)) {
//             selection = lastSelection as RangeSelection | null
//             if (!$isRangeSelection(selection)) {
//               return false
//             }
//           }

//           const focusNode = selection.focus.getNode()

//           if (focusNode !== null) {
//             const horizontalRuleNode = $createLabelNode({
//               url
//             })
//             $insertNodeToNearestRoot(horizontalRuleNode)
//           }

//           return true
//         },
//         COMMAND_PRIORITY_EDITOR
//       ),
//       editor.registerCommand(
//         OPEN_LABEL_DRAWER_COMMAND,
//         (labelData) => {
//           setLabelData(labelData?.data ?? {})
//           setTargetNodeKey(labelData?.nodeKey ?? null)

//           if (labelData?.nodeKey) {
//             toggleModal(drawerSlug)
//             return true
//           }

//           let rangeSelection: RangeSelection | null = null

//           editor.getEditorState().read(() => {
//             const selection = $getSelection()
//             if ($isRangeSelection(selection)) {
//               rangeSelection = selection
//             }
//           })

//           if (rangeSelection) {
//             setLastSelection(rangeSelection)
//             toggleModal(drawerSlug)
//           }
//           return true
//         },
//         COMMAND_PRIORITY_EDITOR
//       )
//     )
//   }, [editor, lastSelection, targetNodeKey, toggleModal])

//   return (
//     <FieldsDrawer
//       data={labelData}
//       drawerSlug={drawerSlug}
//       drawerTitle={'Create Label'}
//       featureKey="label"
//       handleDrawerSubmit={(_fields, data) => {
//         closeModal(drawerSlug)
//         if (!data.url) {
//           return
//         }

//         editor.dispatchCommand(INSERT_LABEL_COMMAND, {
//           url: data.url as string
//         })
//       }}
//       schemaPathSuffix="fields"
//     />
//   )
// }

// 'use server'
// /* eslint-disable @typescript-eslint/no-explicit-any */

// type BaseEditor = {
//   shouldBreakOutOnEnter?: (element: any) => boolean
// }

// type RichTextPlugin = (editor: BaseEditor) => BaseEditor

// const LabelPlugin: RichTextPlugin = (
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

// export default LabelPlugin
// const withLabel: RichTextPlugin = (incomingEditor) => {
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

// export default withLabel;
