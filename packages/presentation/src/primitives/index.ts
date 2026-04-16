/**
 * UI Primitives
 *
 * Base primitive components that serve as building blocks
 * for more complex components. These are low-level, unstyled
 * or minimally styled components.
 */

export { Box, type BoxProps } from './Box.js';
export { Flex, type FlexProps } from './Flex.js';
export { Grid, type GridProps } from './Grid.js';
// CVA primitive variants re-exported under aliases  -  the default `Heading` and
// `Text` from `./components` are the Catalyst-style canonical API.
export {
  Heading as HeadingPrimitive,
  type HeadingProps as HeadingPrimitiveProps,
} from './Heading.js';
export { Slot, type SlotProps } from './Slot.js';
export {
  Text as TextPrimitive,
  type TextProps as TextPrimitiveProps,
} from './Text.js';
