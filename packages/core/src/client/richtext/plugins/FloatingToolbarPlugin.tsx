"use client";

/**
 * RevealUI Rich Text Editor - Floating Toolbar Plugin
 *
 * A floating toolbar that appears above selected text, similar to Medium's editor.
 */

import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
	$isListNode,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
	ListNode,
	REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$createHeadingNode,
	$createQuoteNode,
	$isHeadingNode,
	type HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
	$findMatchingParent,
	$getNearestNodeOfType,
	mergeRegister,
} from "@lexical/utils";

import {
	$createParagraphNode,
	$getSelection,
	$isRangeSelection,
	$isRootOrShadowRoot,
	CAN_REDO_COMMAND,
	CAN_UNDO_COMMAND,
	COMMAND_PRIORITY_CRITICAL,
	FORMAT_TEXT_COMMAND,
	REDO_COMMAND,
	SELECTION_CHANGE_COMMAND,
	UNDO_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RichTextFeature } from "../../../richtext/index.js";
import { ImageUploadButton } from "../components/ImageUploadButton.js";

// ============================================
// TYPES
// ============================================

type BlockType =
	| "paragraph"
	| "h1"
	| "h2"
	| "h3"
	| "h4"
	| "h5"
	| "h6"
	| "quote"
	| "bullet"
	| "number"
	| "check";

interface ToolbarState {
	isBold: boolean;
	isItalic: boolean;
	isUnderline: boolean;
	isStrikethrough: boolean;
	isCode: boolean;
	isSubscript: boolean;
	isSuperscript: boolean;
	isLink: boolean;
	blockType: BlockType;
	canUndo: boolean;
	canRedo: boolean;
}

interface FloatingToolbarPosition {
	top: number;
	left: number;
	visible: boolean;
}

// ============================================
// FLOATING TOOLBAR PLUGIN COMPONENT
// ============================================

export interface FloatingToolbarPluginProps {
	features: RichTextFeature[];
}

export function FloatingToolbarPlugin({
	features,
}: FloatingToolbarPluginProps) {
	const [editor] = useLexicalComposerContext();
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<FloatingToolbarPosition>({
		top: 0,
		left: 0,
		visible: false,
	});

	const [state, setState] = useState<ToolbarState>({
		isBold: false,
		isItalic: false,
		isUnderline: false,
		isStrikethrough: false,
		isCode: false,
		isSubscript: false,
		isSuperscript: false,
		isLink: false,
		blockType: "paragraph",
		canUndo: false,
		canRedo: false,
	});

	// Update toolbar state and position based on selection
	const updateToolbar = useCallback(() => {
		const selection = $getSelection();

		if (!$isRangeSelection(selection) || selection.isCollapsed()) {
			setPosition((prev) => ({ ...prev, visible: false }));
			return;
		}

		// Get DOM selection for positioning
		const domSelection = window.getSelection();
		if (!domSelection || domSelection.rangeCount === 0) {
			setPosition((prev) => ({ ...prev, visible: false }));
			return;
		}

		const range = domSelection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		const editorRootElement = editor.getRootElement();

		if (!editorRootElement) {
			setPosition((prev) => ({ ...prev, visible: false }));
			return;
		}

		// Calculate toolbar position
		const _editorRect = editorRootElement.getBoundingClientRect();
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		const scrollLeft =
			window.pageXOffset || document.documentElement.scrollLeft;

		// Position toolbar above selection, centered horizontally
		const toolbarHeight = toolbarRef.current?.offsetHeight || 40;
		const toolbarWidth = toolbarRef.current?.offsetWidth || 200;

		const top = rect.top + scrollTop - toolbarHeight - 8; // 8px gap above selection
		const left = rect.left + scrollLeft + rect.width / 2 - toolbarWidth / 2;

		setPosition({
			top: Math.max(8, top), // Don't go above viewport
			left: Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8)), // Keep within viewport
			visible: true,
		});

		// Update formatting state
		setState((prev) => ({
			...prev,
			isBold: selection.hasFormat("bold"),
			isItalic: selection.hasFormat("italic"),
			isUnderline: selection.hasFormat("underline"),
			isStrikethrough: selection.hasFormat("strikethrough"),
			isCode: selection.hasFormat("code"),
			isSubscript: selection.hasFormat("subscript"),
			isSuperscript: selection.hasFormat("superscript"),
		}));

		// Block type
		const anchorNode = selection.anchor.getNode();
		let element =
			anchorNode.getKey() === "root"
				? anchorNode
				: $findMatchingParent(anchorNode, (e) => {
						const parent = e.getParent();
						return parent !== null && $isRootOrShadowRoot(parent);
					});

		if (element === null) {
			element = anchorNode.getTopLevelElementOrThrow();
		}

		const elementKey = element.getKey();
		const elementDOM = editor.getElementByKey(elementKey);

		if (elementDOM !== null) {
			// Check list type
			if ($isListNode(element)) {
				const parentList = $getNearestNodeOfType(anchorNode, ListNode);
				const type = parentList
					? parentList.getListType()
					: (element as ListNode).getListType();

				setState((prev) => ({
					...prev,
					blockType:
						type === "bullet"
							? "bullet"
							: type === "number"
								? "number"
								: "check",
				}));
			} else {
				// Check heading type
				const type = $isHeadingNode(element)
					? element.getTag()
					: element.getType();

				if (type === "paragraph" || type === "root") {
					setState((prev) => ({ ...prev, blockType: "paragraph" }));
				} else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(type)) {
					setState((prev) => ({ ...prev, blockType: type as BlockType }));
				} else if (type === "quote") {
					setState((prev) => ({ ...prev, blockType: "quote" }));
				}
			}
		}

		// Link state
		const node = selection.anchor.getNode();
		const parent = node.getParent();
		setState((prev) => ({
			...prev,
			isLink: $isLinkNode(parent) || $isLinkNode(node),
		}));
	}, [editor]);

	// Register listeners
	useEffect(() => {
		return mergeRegister(
			editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => {
					updateToolbar();
				});
			}),
			editor.registerCommand(
				SELECTION_CHANGE_COMMAND,
				() => {
					updateToolbar();
					return false;
				},
				COMMAND_PRIORITY_CRITICAL,
			),
			editor.registerCommand(
				CAN_UNDO_COMMAND,
				(payload) => {
					setState((prev) => ({ ...prev, canUndo: payload }));
					return false;
				},
				COMMAND_PRIORITY_CRITICAL,
			),
			editor.registerCommand(
				CAN_REDO_COMMAND,
				(payload) => {
					setState((prev) => ({ ...prev, canRedo: payload }));
					return false;
				},
				COMMAND_PRIORITY_CRITICAL,
			),
		);
	}, [editor, updateToolbar]);

	// Handle window scroll/resize to reposition toolbar
	useEffect(() => {
		const handleScroll = () => {
			updateToolbar();
		};

		window.addEventListener("scroll", handleScroll, true);
		window.addEventListener("resize", handleScroll);

		return () => {
			window.removeEventListener("scroll", handleScroll, true);
			window.removeEventListener("resize", handleScroll);
		};
	}, [updateToolbar]);

	// Format commands (same as ToolbarPlugin)
	const formatBold = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
	const formatItalic = () =>
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
	const formatUnderline = () =>
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
	const _formatStrikethrough = () =>
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
	const _formatCode = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
	const _formatSubscript = () =>
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, "subscript");
	const _formatSuperscript = () =>
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, "superscript");

	const undo = () => editor.dispatchCommand(UNDO_COMMAND, undefined);
	const redo = () => editor.dispatchCommand(REDO_COMMAND, undefined);

	// Block type commands
	const formatParagraph = () => {
		editor.update(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) {
				$setBlocksType(selection, () => $createParagraphNode());
			}
		});
	};

	const formatHeading = (tag: HeadingTagType) => {
		if (state.blockType !== tag) {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					$setBlocksType(selection, () => $createHeadingNode(tag));
				}
			});
		}
	};

	const formatQuote = () => {
		if (state.blockType !== "quote") {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					$setBlocksType(selection, () => $createQuoteNode());
				}
			});
		}
	};

	const formatBulletList = () => {
		if (state.blockType !== "bullet") {
			editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
		} else {
			editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
		}
	};

	const formatNumberedList = () => {
		if (state.blockType !== "number") {
			editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
		} else {
			editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
		}
	};

	const insertLink = () => {
		if (!state.isLink) {
			const url = prompt("Enter URL:");
			if (url) {
				editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
			}
		} else {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
		}
	};

	// Check which features are enabled
	const hasFeature = (key: string) => features.some((f) => f.key === key);

	// Check if floating toolbar should be shown
	const showToolbar =
		features.some((f) => f.type === "toolbar" && f.position === "floating") ||
		features.some(
			(f) => f.key === "floatingToolbar" || f.key === "floating-toolbar",
		);

	if (!showToolbar || !position.visible) {
		return null;
	}

	const toolbarContent = (
		// biome-ignore lint: Floating toolbar needs absolute positioning and event handling
		<div
			ref={toolbarRef}
			className="editor-toolbar editor-toolbar--floating"
			style={{
				position: "absolute",
				top: `${position.top}px`,
				left: `${position.left}px`,
				zIndex: 1000,
				opacity: position.visible ? 1 : 0,
				pointerEvents: position.visible ? "auto" : "none",
			}}
			onMouseDown={(e) => e.preventDefault()} // Prevent losing selection when clicking toolbar
		>
			{/* History */}
			{hasFeature("history") && (
				<div className="toolbar-group">
					<button
						type="button"
						disabled={!state.canUndo}
						onClick={undo}
						className="toolbar-btn"
						title="Undo (Ctrl+Z)"
						aria-label="Undo"
					>
						↶
					</button>
					<button
						type="button"
						disabled={!state.canRedo}
						onClick={redo}
						className="toolbar-btn"
						title="Redo (Ctrl+Y)"
						aria-label="Redo"
					>
						↷
					</button>
				</div>
			)}

			{/* Text formatting */}
			<div className="toolbar-group">
				{hasFeature("bold") && (
					<button
						type="button"
						onClick={formatBold}
						className={`toolbar-btn ${state.isBold ? "active" : ""}`}
						title="Bold (Ctrl+B)"
						aria-label="Bold"
						aria-pressed={state.isBold}
					>
						<strong>B</strong>
					</button>
				)}
				{hasFeature("italic") && (
					<button
						type="button"
						onClick={formatItalic}
						className={`toolbar-btn ${state.isItalic ? "active" : ""}`}
						title="Italic (Ctrl+I)"
						aria-label="Italic"
						aria-pressed={state.isItalic}
					>
						<em>I</em>
					</button>
				)}
				{hasFeature("underline") && (
					<button
						type="button"
						onClick={formatUnderline}
						className={`toolbar-btn ${state.isUnderline ? "active" : ""}`}
						title="Underline (Ctrl+U)"
						aria-label="Underline"
						aria-pressed={state.isUnderline}
					>
						<span style={{ textDecoration: "underline" }}>U</span>
					</button>
				)}
				{hasFeature("link") && (
					<button
						type="button"
						onClick={insertLink}
						className={`toolbar-btn ${state.isLink ? "active" : ""}`}
						title="Insert Link"
						aria-label="Insert Link"
						aria-pressed={state.isLink}
					>
						🔗
					</button>
				)}
				{hasFeature("upload") && <ImageUploadButton />}
			</div>

			{/* Block formatting - simplified for floating toolbar */}
			{hasFeature("heading") && (
				<div className="toolbar-group">
					<select
						className="toolbar-select"
						value={state.blockType}
						onChange={(e) => {
							const value = e.target.value as BlockType;
							if (value === "paragraph") formatParagraph();
							else if (value.startsWith("h"))
								formatHeading(value as HeadingTagType);
							else if (value === "quote") formatQuote();
						}}
					>
						<option value="paragraph">Paragraph</option>
						<option value="h1">H1</option>
						<option value="h2">H2</option>
						<option value="h3">H3</option>
					</select>
				</div>
			)}

			{/* List formatting */}
			{(hasFeature("list") ||
				hasFeature("orderedList") ||
				hasFeature("unorderedList")) && (
				<div className="toolbar-group">
					<button
						type="button"
						onClick={formatBulletList}
						className={`toolbar-btn ${state.blockType === "bullet" ? "active" : ""}`}
						title="Bullet List"
						aria-label="Bullet List"
					>
						•
					</button>
					<button
						type="button"
						onClick={formatNumberedList}
						className={`toolbar-btn ${state.blockType === "number" ? "active" : ""}`}
						title="Numbered List"
						aria-label="Numbered List"
					>
						1.
					</button>
				</div>
			)}
		</div>
	);

	// Render via portal to body for proper positioning
	return typeof document !== "undefined"
		? createPortal(toolbarContent, document.body)
		: null;
}

export default FloatingToolbarPlugin;
