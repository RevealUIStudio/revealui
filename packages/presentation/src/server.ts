/**
 * @revealui/presentation/server
 *
 * Server-safe components that can be used in React Server Components.
 * These components don't use React hooks and can be rendered on the server.
 */

// Layout Components - Server Safe
export { AuthLayout, type AuthLayoutProps } from './components/auth-layout.js';

// CVA Components - Server Safe
export {
  Button as ButtonCVA,
  type ButtonProps,
  buttonVariants,
} from './components/Button.js';
export { Breadcrumb, type BreadcrumbItem } from './components/breadcrumb.js';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/Card.js';
export { EmptyState } from './components/empty-state.js';
export { FormLabel, type FormLabelProps } from './components/FormLabel.js';
export { FormField, type FormFieldProps } from './components/form-field.js';
export { Input as InputCVA, type InputProps } from './components/Input.js';
export { Label, type LabelProps } from './components/Label.js';
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  type PaginationEllipsisProps,
  PaginationItem,
  PaginationLink,
  type PaginationLinkProps,
  PaginationNext,
  type PaginationNextProps,
  PaginationPrevious,
  type PaginationPreviousProps,
  type PaginationProps,
} from './components/Pagination.js';
export {
  PricingTable,
  type PricingTableProps,
  type PricingTier,
} from './components/pricing-table.js';

export { Skeleton, SkeletonCard, SkeletonText } from './components/skeleton.js';
export { Textarea as TextareaCVA, type TextareaProps } from './components/Textarea.js';

// Note: Checkbox and Select CVA versions use state and are in client.ts

// Primitives - Server Safe
export { Box, type BoxProps } from './primitives/Box.js';
export { Flex, type FlexProps } from './primitives/Flex.js';
export { Grid, type GridProps } from './primitives/Grid.js';
export { Heading, type HeadingProps } from './primitives/Heading.js';
export { Slot, type SlotProps } from './primitives/Slot.js';
export { Text, type TextProps } from './primitives/Text.js';

// Utils
export { cn } from './utils/cn.js';
