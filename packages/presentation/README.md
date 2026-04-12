# @revealui/presentation

57 native UI components for RevealUI  -  built with React 19, Tailwind CSS v4, and CVA. Zero external UI library dependencies (only clsx + class-variance-authority).

## Features

- **57 Components**  -  Forms, data display, feedback, navigation, media, and layout
- **6 Primitives**  -  Low-level building blocks (Box, Flex, Grid, Heading, Text, Slot)
- **14 Hooks**  -  Focus trap, click outside, popover, roving tabindex, scroll lock, and more
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

## Components (57)

### Layout
| Component | Description |
|-----------|-------------|
| AuthLayout | Authentication page layout |
| SidebarLayout | Sidebar + content layout |
| StackedLayout | Stacked page layout |
| Navbar | Top navigation bar |
| Sidebar | Side navigation |

### Form Controls
| Component | Description |
|-----------|-------------|
| Button / ButtonCVA | Action trigger (headless + styled) |
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

## Primitives (6)

| Primitive | Description |
|-----------|-------------|
| Box | Generic container |
| Flex | Flexbox layout |
| Grid | CSS Grid layout |
| Heading | Semantic heading |
| Text | Text content |
| Slot | Component composition utility |

## Hooks (14)

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
| usePopover | Popover positioning |
| useRovingTabindex | Keyboard navigation in groups |
| useScrollLock | Prevent body scroll |
| useToggle | Boolean toggle state |
| useTransition | CSS transitions |
| useTypeAhead | Type-ahead search in lists |

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/presentation` | All components, primitives, and hooks |
| `@revealui/presentation/server` | Server components |
| `@revealui/presentation/client` | Client components |
| `@revealui/presentation/components` | Components only |
| `@revealui/presentation/primitives` | Primitives only |
| `@revealui/presentation/hooks` | Hooks only |

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
- You want headless + styled variants so you can choose between full control and quick defaults
- You need React hooks for common UI patterns (focus trap, click outside, popover positioning)
- **Not** for CMS admin UI  -  `@revealui/core/admin` provides the admin dashboard
- **Not** for rich text editing  -  use `@revealui/core/richtext/client` (Lexical-based)

## JOSHUA Alignment

- **Sovereign**: Zero external UI library dependencies  -  only clsx and CVA, so you own every component
- **Orthogonal**: Components, primitives, and hooks are independent subpath exports with no cross-cutting entanglement
- **Justifiable**: Every component ships headless and styled variants because different contexts need different levels of control

## Related

- [Core Package](../core/README.md)  -  Runtime engine (uses presentation components)
- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
