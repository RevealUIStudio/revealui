/**
 * @revealui/presentation/server
 *
 * Server-safe components that can be used in React Server Components.
 * These components don't use React hooks and can be rendered on the server.
 */

// Shared block renderer — marketing section blocks + annotatable primitives.
// Render-only and server-safe (no hooks/state), so they belong on /server.
export {
  type AnnotationAttrs,
  type BlockAnnotation,
  CtaSectionBlock,
  type CtaSectionBlockProps,
  DividerBlockView,
  fieldAttrs,
  HeadingBlockView,
  HeroBlock,
  type HeroBlockProps,
  ListBlockView,
  MarketingLinks,
  type MarketingLinksProps,
  QuoteBlockView,
  RenderBlocks,
  type RenderBlocksProps,
  SectionBlock,
  type SectionBlockProps,
  SpacerBlockView,
  TextBlockView,
} from './blocks/index.js';
export { TouchTarget } from './components/_button-shared.js';
// Layout Components - Server Safe
export { AuthLayout, type AuthLayoutProps } from './components/auth-layout.js';
export { BuiltWithRevealUI } from './components/BuiltWithRevealUI.js';
// The owned action button (RSC-safe). `Button` is the sovereign export;
// `ButtonCVA` is a deprecated alias kept for one minor. `TouchTarget` is the
// shared 44px touch hit-area primitive.
export {
  Button,
  Button as ButtonCVA,
  type ButtonProps,
  buttonVariants,
} from './components/Button.js';
export { RevealUIMark, type RevealUIMarkProps } from './components/brand-mark.js';
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
export { Label, Label as ControlLabel, type LabelProps } from './components/Label.js';
// Marketing section shells (no hooks; safe for RSC and static SPAs)
export {
  MarketingSection,
  type MarketingSectionDensity,
  type MarketingSectionProps,
  type MarketingSectionTone,
  type MarketingSectionWidth,
  SectionHeader,
  type SectionHeaderAlign,
  type SectionHeaderEyebrowTone,
  type SectionHeaderProps,
  type SectionHeaderTitleAs,
} from './components/marketing-section.js';
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
export {
  SplitAuthLayout,
  type SplitAuthLayoutProps,
} from './components/split-auth-layout.js';
export { Textarea as TextareaCVA, type TextareaProps } from './components/Textarea.js';
// VerdictChip is presentational (no hooks) and safe in Server Components.
// StatusDot/AuditLine/ReceiptCard use hooks or state and live in client.ts.
export { type Verdict, VerdictChip, type VerdictChipProps } from './components/verdict-chip.js';
export { RevealUIWordmark, type RevealUIWordmarkProps } from './components/wordmark.js';

// Note: Checkbox and Select CVA versions use state and are in client.ts

// Icons - Server Safe (pure SVG, no hooks)
export {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClose,
  IconCode,
  IconCopy,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconGlobe,
  IconHeart,
  IconInfo,
  IconLoading,
  IconLock,
  IconLogOut,
  IconMenu,
  IconMinus,
  IconMonitor,
  IconMoon,
  IconMoreHorizontal,
  IconMoreVertical,
  IconPlus,
  type IconProps,
  IconRefresh,
  IconSearch,
  IconSettings,
  type IconSize,
  IconStar,
  IconSun,
  IconTerminal,
  IconTrash,
  IconUnlock,
  IconUpload,
  IconUser,
  IconUsers,
  IconXCircle,
} from './components/icon.js';
// OAuth provider, social, + passkey icons - Server Safe
export {
  GitHubIcon,
  GoogleIcon,
  LinkedInIcon,
  PasskeyIcon,
  VercelIcon,
  XIcon,
} from './icons/providers.js';

// Primitives - Server Safe
export { Box, type BoxProps } from './primitives/Box.js';
export { Flex, type FlexProps } from './primitives/Flex.js';
export { Grid, type GridProps } from './primitives/Grid.js';
export { Heading, type HeadingProps } from './primitives/Heading.js';
export { Slot, type SlotProps } from './primitives/Slot.js';
export { Text, type TextProps } from './primitives/Text.js';

// Utils
export { cn } from './utils/cn.js';
