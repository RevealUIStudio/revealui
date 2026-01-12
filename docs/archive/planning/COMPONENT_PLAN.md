# Presentation Package Component Plan

## Overview
This document outlines the components to be added to `@revealui/presentation` package for shared use across RevealUI applications.

## Component Categories

### 1. Utilities
- **`cn`** - Classnames utility function for conditional class merging
  - Location: `src/utils/cn.ts`
  - Purpose: Merge Tailwind classes conditionally

### 2. Primitives (`src/primitives/`)
Base building blocks with minimal styling:

- **`Slot`** - Polymorphic component for composition
- **`Box`** - Basic container primitive
- **`Flex`** - Flexbox container primitive
- **`Grid`** - Grid container primitive
- **`Text`** - Typography primitive
- **`Heading`** - Heading primitive

### 3. Core Components (`src/components/`)
Styled, production-ready components:

#### Form Components
- **`Button`** - Button with variants (default, primary, secondary, destructive, ghost, outline, link)
  - Sizes: sm, default, lg, icon, clear
  - Supports asChild pattern
  
- **`Input`** - Text input field
  - Full HTML input props support
  - Accessible styling
  
- **`Textarea`** - Multi-line text input
  - Full HTML textarea props support
  
- **`Select`** - Dropdown select component
  - Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup, SelectLabel, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton
  
- **`Checkbox`** - Checkbox input
  - Supports checked, indeterminate states
  - CheckboxIndicator component
  
- **`Label`** - Form label component
  - Accessible label styling
  
- **`FormLabel`** - Enhanced form label
  - With required indicator support

#### Layout Components
- **`Card`** - Card container component
  - Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
  
#### Navigation Components
- **`Pagination`** - Pagination component
  - Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis

## Implementation Strategy

1. **Extract from CMS app** - Most components exist in `apps/cms/src/lib/components/ui/`
2. **Make framework-agnostic** - Remove app-specific imports (like `@/lib/styles/classnames`)
3. **Add to presentation package** - Place in appropriate directories
4. **Update exports** - Ensure all components are exported
5. **Test build** - Verify TypeScript compilation

## Dependencies

- `class-variance-authority` - Already in package.json
- `react` & `react-dom` - Peer dependencies
- Tailwind CSS - Assumed to be available in consuming apps

## File Structure

```
packages/presentation/
├── src/
│   ├── utils/
│   │   └── cn.ts
│   ├── primitives/
│   │   ├── Slot.tsx
│   │   ├── Box.tsx
│   │   ├── Flex.tsx
│   │   ├── Grid.tsx
│   │   ├── Text.tsx
│   │   ├── Heading.tsx
│   │   └── index.ts
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   ├── Label.tsx
│   │   ├── FormLabel.tsx
│   │   ├── Pagination.tsx
│   │   └── index.ts
│   └── index.ts
```

## Notes

- All components use React 19 patterns
- Components are forwardRef compatible
- TypeScript strict mode enabled
- Tailwind CSS classes used (consuming apps must have Tailwind configured)
- Components follow accessibility best practices (WCAG 2.1)
