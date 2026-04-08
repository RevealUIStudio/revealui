//This copy-and-pasted from lexical here: https://github.com/facebook/lexical/blob/c2ceee223f46543d12c574e62155e619f9a18a5d/packages/lexical/src/LexicalConstants.ts

// Import types from @revealui/core/richtext instead of lexical directly
// import type { ElementFormatType, TextFormatType } from "lexical";
type ElementFormatType = 'left' | 'center' | 'right' | 'justify' | 'start' | 'end';
type TextFormatType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'subscript'
  | 'superscript';

export type TextDetailType = 'directionless' | 'unmergable';
export type TextModeType = 'normal' | 'token' | 'segmented';
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// DOM
export const DOM_ELEMENT_TYPE = 1;
export const DOM_TEXT_TYPE = 3;

// Reconciling
export const NO_DIRTY_NODES = 0;
export const HAS_DIRTY_NODES = 1;
export const FULL_RECONCILE = 2;

// Text node modes
export const IS_NORMAL = 0;
export const IS_TOKEN = 1;
export const IS_SEGMENTED = 2;
// IS_INERT = 3

// Text node formatting
export const IS_BOLD = 1;
export const IS_ITALIC = 1 << 1;
export const IS_STRIKETHROUGH = 1 << 2;
export const IS_UNDERLINE = 1 << 3;
export const IS_CODE = 1 << 4;
export const IS_SUBSCRIPT = 1 << 5;
export const IS_SUPERSCRIPT = 1 << 6;
export const IS_HIGHLIGHT = 1 << 7;

export const IS_ALL_FORMATTING =
  IS_BOLD |
  IS_ITALIC |
  IS_STRIKETHROUGH |
  IS_UNDERLINE |
  IS_CODE |
  IS_SUBSCRIPT |
  IS_SUPERSCRIPT |
  IS_HIGHLIGHT;

// Text node details
export const IS_DIRECTIONLESS = 1;
export const IS_UNMERGEABLE = 1 << 1;

// Element node formatting
export const IS_ALIGN_LEFT = 1;
export const IS_ALIGN_CENTER = 2;
export const IS_ALIGN_RIGHT = 3;
export const IS_ALIGN_JUSTIFY = 4;
export const IS_ALIGN_START = 5;
export const IS_ALIGN_END = 6;

// Reconciliation
export const NON_BREAKING_SPACE = '\u00A0';
export const ZERO_WIDTH_SPACE = '\u200b';

export const DOUBLE_LINE_BREAK = '\n\n';

// For FF, we need to use a non-breaking space, or it gets composition
// in a stuck state.
// For FF, we need to use a non-breaking space, or it gets composition
// in a stuck state.

// Define RTL characters explicitly
const RTL =
  '\u0591\u0592\u0593\u0594\u0595\u0596\u0597\u0598\u0599' +
  '\u059A\u059B\u059C\u059D\u059E\u059F\u05A0\u05A1\u05A2' +
  '\u05A3\u05A4\u05A5\u05A6\u05A7\u05A8\u05A8\u05A9' +
  '\u05AA\u05AB\u05AC\u05AD\u05AE\u05AF\u05B0\u05B1' +
  '\u05B2\u05B3\u05B4\u05B5\u05B6\u05B7\u05B8\u05B9' +
  '\u05BA\u05BB\u05BC\u05BD\u05BE\u05BF\u05C0\u05C1' +
  '\u05C2\u05C3\u05C4\u05C5\u05C6\u05C7\u05C8\u05C9' +
  '\u05CA\u05CB\u05CC\u05CD\u05CE\u05CF' +
  '\u0600-\u06FF' + // Arabic
  '\u0700-\u077F'; // Syriac

// Define LTR characters explicitly
const LTR =
  'A-Za-z' +
  '\u00C0-\u00D6' + // Latin-1 Supplement
  '\u00D8-\u00F6' + // Latin-1 Supplement
  '\u00F8-\u02B8' +
  '\u0300-\u0590' + // Combining Diacritical Marks
  '\u0800-\u1FFF' + // Various
  '\u200E' + // Left-to-right mark
  '\u2C00-\uFB1C' +
  '\uFE00-\uFE6F' + // Combining Half Marks
  '\uFEFD-\uFFFF'; // Private use

// Use regex without the misleading character class
export const RTL_REGEX = new RegExp(
  `^[^${LTR.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]*[${RTL.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`,
);
export const LTR_REGEX = new RegExp(
  `^[^${RTL.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]*[${LTR.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`,
);

export const TEXT_TYPE_TO_FORMAT: Record<TextFormatType | string, number> = {
  bold: IS_BOLD,
  code: IS_CODE,
  highlight: IS_HIGHLIGHT,
  italic: IS_ITALIC,
  strikethrough: IS_STRIKETHROUGH,
  subscript: IS_SUBSCRIPT,
  superscript: IS_SUPERSCRIPT,
  underline: IS_UNDERLINE,
};

export const DETAIL_TYPE_TO_DETAIL: Record<TextDetailType | string, number> = {
  directionless: IS_DIRECTIONLESS,
  unmergeable: IS_UNMERGEABLE,
};

export const ELEMENT_TYPE_TO_FORMAT: Record<Exclude<ElementFormatType, ''>, number> = {
  center: IS_ALIGN_CENTER,
  end: IS_ALIGN_END,
  justify: IS_ALIGN_JUSTIFY,
  left: IS_ALIGN_LEFT,
  right: IS_ALIGN_RIGHT,
  start: IS_ALIGN_START,
};

export const ELEMENT_FORMAT_TO_TYPE: Record<number, ElementFormatType> = {
  [IS_ALIGN_CENTER]: 'center',
  [IS_ALIGN_END]: 'end',
  [IS_ALIGN_JUSTIFY]: 'justify',
  [IS_ALIGN_LEFT]: 'left',
  [IS_ALIGN_RIGHT]: 'right',
  [IS_ALIGN_START]: 'start',
};

export const TEXT_MODE_TO_TYPE: Record<TextModeType, 0 | 1 | 2> = {
  normal: IS_NORMAL,
  segmented: IS_SEGMENTED,
  token: IS_TOKEN,
};

export const TEXT_TYPE_TO_MODE: Record<number, TextModeType> = {
  [IS_NORMAL]: 'normal',
  [IS_SEGMENTED]: 'segmented',
  [IS_TOKEN]: 'token',
};
