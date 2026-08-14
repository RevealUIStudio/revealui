---
title: "@revealui/presentation"
description: "65 native UI components for RevealUI - built with React 19 and Tailwind CSS v4. No external UI library dependencies (ships its own `cn`/`cva`; only `tailwind-merge` is a runtime..."
visibility: public
status: verified
audience: user
---

# @revealui/presentation

65 native UI components for RevealUI  -  built with React 19 and Tailwind CSS v4. No external UI library dependencies (ships its own `cn`/`cva`; only `tailwind-merge` is a runtime dep).

## Features

- **65 Components**  -  Forms, data display, feedback, navigation, media, and layout
- **6 Primitives**  -  Low-level building blocks (Box, Flex, Grid, Heading, Text, Slot)
- **16 Hooks**  -  Focus trap, click outside, popover, roving tabindex, scroll lock, and more
- **Headless + Styled**  -  Many components ship both unstyled (headless) and styled (CVA) variants
- **Accessible**  -  WCAG 2.1 patterns with proper ARIA attributes
- **React 19**  -  Server components, hooks, and modern patterns
- **Tailwind CSS v4**  -  Native v4 utility classes, no v3 compat layer

## Installation

```bash
pnpm add @revealui/presentation
```

## Usage

```typescript
import { Button, Card, Input, Badge } from '@revealui/presentation'
import { Box, Flex } from '@revealui/presentation/primitives'
import { useClickOutside, useFocusTrap } from '@revealui/presentation/hooks'
```

## Components (65)

### Layout
| Component | Description |
|-----------|-------------|
| AuthLayout | Authentication page layout |
| SplitAuthLayout | Split authentication page layout |
| SidebarLayout | Sidebar + content layout |
| StackedLayout | Stacked page layout |
| Navbar | Top navigation bar |
| Sidebar | Side navigation |

### Form Controls
| Component | Description |
|-----------|-------------|
| Button (ButtonCVA alias) | Action trigger (owned CVA button; not dual-headless) |
| Input / InputCVA | Text input (headless + styled) |
| Textarea / TextareaCVA | Multi-line text (headless + styled) |
| Checkbox / CheckboxCVA | Checkbox (headless + styled) |
| Select / SelectCVA | Dropdown select with subcomponents |
| Combobox | Searchable select |
| Listbox | List selection |
| Radio | Radio group |
| Switch | Toggle switch |
| Label / FormLabel | Form labels |
| Fieldset | Form field grouping |
| FormField | Form field wrapper |
| LinkButton | Link-styled button |

### Data Display
| Component | Description |
|-----------|-------------|
| Card | Content container (header, title, description, content, footer) |
| Table | Data table |
| Pagination | Page navigation |
| Badge | Status indicator |
| Text | Styled text |
| Heading | Section heading |
| Divider | Horizontal rule |
| DescriptionList | Key-value pairs |
| Breadcrumb | Navigation trail |

### Feedback
| Component | Description |
|-----------|-------------|
| Alert | Inline alert message |
| Callout | Highlighted information |
| Toast | Temporary notification (with provider + hook) |
| Tooltip | Hover information |
| Progress | Progress bar |
| Slider | Range input |
| Skeleton | Loading placeholder |
| EmptyState | No-data placeholder |
| Stat | Metric display (with StatGroup) |
| Rating | Star rating |

### Navigation
| Component | Description |
|-----------|-------------|
| Accordion | Collapsible sections |
| Tabs | Tab panels |
| Stepper | Step-by-step progress |
| Timeline | Chronological events |
| Dropdown | Action menu |
| Drawer | Slide-out panel |
| Dialog | Modal dialog |

### Media & Misc
| Component | Description |
|-----------|-------------|
| Avatar / AvatarGroup | User avatars |
| CodeBlock | Syntax-highlighted code |
| Kbd / KbdShortcut | Keyboard shortcut display |
| Link | Styled anchor |
| PricingTable | Pricing tiers table |
| ReceiptCard | Receipt / audit-style card |
| AuditLine | Single audit receipt line |
| StatusDot | Status indicator dot |
| VerdictChip | Verdict / decision chip |
| BrandMark / Wordmark | Brand mark and wordmark |
| BuiltWithRevealUI | Built-with badge |

## Primitives (6)

| Primitive | Description |
|-----------|-------------|
| Box | Generic container |
| Flex | Flexbox layout |
| Grid | CSS Grid layout |
| HeadingPrimitive | Semantic heading (canonical `Heading` is exported from the main components entry) |
| TextPrimitive | Text content (canonical `Text` is exported from the main components entry) |
| Slot | Component composition utility |

## Hooks (16)

| Hook | Purpose |
|------|---------|
| useClickOutside | Detect clicks outside an element |
| useCloseContext | Shared close handler context |
| useControllableState | Controlled/uncontrolled state |
| useDataInteractive | Interactive element data attributes |
| useEscapeKey | Escape key handler |
| useFieldContext | Form field context (label, error, description) |
| useFocusTrap | Trap focus within an element |
| useLayoutAnimation | Animated layout transitions |
| useLinkBehavior | Pluggable link behavior (custom router integration) |
| usePopover | Popover positioning |
| useRovingTabindex | Keyboard navigation in groups |
| useScrollLock | Prevent body scroll |
| useTheme | Theme detection (light/dark/system). Pair with `THEME_BOOTSTRAP_SCRIPT` in `<head>` so the first paint already has `data-theme`. |
| useToggle | Boolean toggle state |
| useTransition | CSS transitions |
| useTypeAhead | Type-ahead search in lists |

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/presentation` | All components, primitives, and hooks. Also `THEME_BOOTSTRAP_SCRIPT`, `THEME_STORAGE_KEY`, `THEME_DATA_ATTR`. |
| `@revealui/presentation/server` | Server components plus the same theme-bootstrap constants (safe in RSC / `beforeInteractive`) |
| `@revealui/presentation/client` | Client components |
| `@revealui/presentation/components` | Components only |
| `@revealui/presentation/primitives` | Primitives only |
| `@revealui/presentation/hooks` | Hooks plus `THEME_STORAGE_KEY` / `THEME_DATA_ATTR` |
| `@revealui/presentation/animations` | Animation utilities |
| `@revealui/presentation/tokens.css` | Design token CSS file |

## Styled vs headless components (the `*CVA` convention)

**Most components are a single styled implementation.** A few form controls still ship dual
exports: the bare name is the headless (Catalyst) primitive; the `*CVA` suffix is the
token-driven styled variant.

| Headless (bare name) | Styled (`*CVA`) | Source files |
|----------------------|-----------------|--------------|
| `Input`    | `InputCVA`    | `input-headless.tsx`, `Input.tsx` |
| `Textarea` | `TextareaCVA` | `textarea-headless.tsx`, `Textarea.tsx` |
| `Checkbox` | `CheckboxCVA` | `checkbox-headless.tsx`, `Checkbox.tsx` |
| `Select`   | `SelectCVA`   | `select-headless.tsx`, `Select.tsx` |

**Button is not dual.** `Button` is the owned brand-token button (`Button.tsx`).
`ButtonCVA` is a deprecated alias of `Button` for older call sites. There is no
`button-headless.tsx`.

### `Button` props

Two orthogonal axes (see `packages/presentation/src/components/Button.tsx`):

- `variant`: semantic colour intent — `brand` | `neutral` | `success` | `warning` | `danger`
- `appearance`: visual weight — `solid` | `outline` | `ghost` | `link`
- `size`: `sm` | `default` | `lg` | `icon` | `clear`
- plus `asChild`, `isLoading`, `glow`, `shine`

```tsx
import { Button } from '@revealui/presentation'

<Button variant="brand" appearance="solid" glow>Get started</Button>
<Button variant="brand" appearance="solid" size="lg" shine>Upgrade</Button>
<Button isLoading>Saving...</Button>
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Watch mode
pnpm dev
```

## Adding Components

1. Create component in `src/components/` (styled) or `src/primitives/` (unstyled)
2. Export from the respective `index.ts`
3. Use CVA for variant-based styling
4. Follow WCAG 2.1 accessibility patterns

## When to Use This

- You need accessible, styled UI components (buttons, forms, cards, dialogs) for a RevealUI app
- You want token-driven components, with headless + `*CVA` duals on selected form controls
- You need React hooks for common UI patterns (focus trap, click outside, popover positioning)
- **Not** for CMS admin UI  -  `@revealui/core/admin` provides the admin dashboard
- **Not** for rich text editing  -  use `@revealui/core/richtext/client` (Lexical-based)

## Design Principles

- **Sovereign**: No external UI library dependencies (no Radix, no shadcn). Ships its own `cn` + `cva` implementations; only `tailwind-merge` is a runtime dep for class conflict resolution
- **Orthogonal**: Components, primitives, and hooks are independent subpath exports with no cross-cutting entanglement
- **Justifiable**: Selected form controls ship headless + styled duals; most components are a single owned implementation

## Related

- [Core Package](../core/README.md)  -  Runtime engine (uses presentation components)
- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
