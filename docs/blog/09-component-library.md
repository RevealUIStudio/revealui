---
title: "66 Components, One Dependency"
description: "*By Joshua Vaughn, RevealUI Studio*"
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

Open the `package.json` of a typical React app and trace the dependency tree under your UI. A component library. The headless-primitive library it sits on. An icon set. A class-merging utility. A variants helper. A few polyfills the library pulls in. Every one of those is a version you have to track, a breaking change you have to absorb on someone else's schedule, and a styling opinion you have to work around.

RevealUI's UI layer, `@revealui/presentation`, has exactly one third-party runtime dependency. Not one UI framework. One npm package: `tailwind-merge`. Its design tokens come from a sibling in-house package, `@revealui/tokens`. Everything else, the 66 components and the machinery that powers them, is in the box and MIT licensed.

This post is about why a component library should be something you own outright, and how this one is built.

## The cost of "just use a component library"

Component libraries are a good trade right up until they aren't. You move fast for six months. Then the library ships a major version that rewrites its theming API, and your design tokens stop resolving. Or the headless primitive it depends on changes its focus-management behavior and your dialog starts trapping keyboard focus in the wrong place. Or you need a component the library does not have, so you bolt on a second library, and now two different abstractions own your markup.

The deeper problem is that the most important layer of your product, the part your users actually touch, is code you did not write and cannot change without forking. When something renders wrong at 11pm before a launch, you are reading someone else's source in `node_modules` hoping you can monkey-patch your way out.

I have done that enough times to want a different deal.

## What ships in the box

`@revealui/presentation` is 66 native React components. Not wrappers around another library. Components, built directly on Tailwind v4 and React.

The set is meant to cover real business software, not just a demo: `accordion`, `alert`, `avatar`, `badge`, `breadcrumb`, `callout`, `card`, `checkbox`, `code-block`, `combobox`, `dialog`, `drawer`, `divider`, `description-list`, and on through the list. Form controls, overlays, navigation, data display. The pieces you reach for on day one and the ones you need in month three.

The dependency story is the headline:

- **One third-party runtime dependency:** `tailwind-merge`, for safely merging Tailwind class lists. Design tokens come from the in-house `@revealui/tokens` package, not from npm.
- **React is a peer dependency**, not a bundled copy. The package works on React 18 or 19; RevealUI runs it on 19.
- **Tailwind v4** for styling.

That is the whole external surface. There is no component framework underneath.

## No library underneath

It is worth being specific, because "zero dependencies" is a claim people make loosely. Search the source of `@revealui/presentation` for Radix, MUI, Headless UI, Chakra, or React Aria and you will find nothing. There is no `class-variance-authority` either, which is the one most projects keep even after they drop the rest.

The three things those libraries usually provide are all in-package:

- The **variant system** (`cva`) and the **class-merge helper** (`cn`) live in `packages/presentation/src/utils/cn.ts`.
- The **polymorphic `Slot`** that powers the `asChild` pattern lives in `packages/presentation/src/primitives/Slot.ts`.

So a component imports its tooling from inside the package, not from npm:

```tsx
// packages/presentation/src/components/Button.tsx
import { cn, cva, type VariantProps } from '../utils/cn.js';
import { Slot } from '../primitives/Slot.js';

const buttonVariants = cva('inline-flex items-center justify-center …', {
  variants: {
    variant: { brand: '…', neutral: '…', success: '…', warning: '…', danger: '…' },
    appearance: { solid: '…', outline: '…', ghost: '…', link: '…' },
    size: { sm: '…', default: '…', lg: '…', icon: '…', clear: '…' },
  },
  defaultVariants: { variant: 'brand', appearance: 'solid', size: 'default' },
});
```

If a variant behaves wrong, the fix is in your tree, not in a dependency you are pinned to.

## Variants without the dependency

The API will feel familiar if you have used `class-variance-authority`, because that is the shape worth keeping. You define variants, you get a typed `VariantProps`, and the merge helper makes sure a caller-supplied `className` wins cleanly over the defaults instead of producing two conflicting Tailwind classes.

The `asChild` pattern works the same way it does in the libraries that popularized it. Pass `asChild` and the component renders its child instead of its own element, forwarding props and merging classes through the in-house `Slot`. A `Button` becomes a link without losing its styling or its keyboard behavior:

```tsx
<Button asChild variant="brand">
  <a href="/signup">Start free</a>
</Button>
```

You get the ergonomics. You do not get the dependency.

## Headless when you want behavior, not styling

Some form controls still ship in two forms. Alongside the styled `Checkbox` there is `checkbox-headless`: the behavior, state, and accessibility wiring with none of the visual opinion. `Button` is not on that track — it is a single owned component with `variant` and `appearance`, and there is no `button-headless`. When the default styling is not what you want, you drop down a level and bring your own classes, without giving up focus management, ARIA attributes, and keyboard handling.

That split matters for a framework. The styled components get you to a working product fast. The headless ones mean you never hit a wall where the only way forward is to rip the library out.

## Theming is tokens, not hardcoded colors

Colors are not baked into the components. They resolve through a semantic design-token layer in `tokens.css`: `bg-background`, `text-foreground`, `border-border`, `text-primary`, and so on. The tokens carry RevealUI's cobalt palette and adapt to light and dark. Retheme the whole system by changing the token values in one place; you do not touch 66 component files to change your brand color.

Because the tokens are semantic rather than literal, a component never says "blue." It says "primary," and the token decides what primary means in the current theme.

## The trade-off

Here is the honest version. A from-scratch component layer trades away two real things: the ecosystem breadth of a Radix or an MUI, and the millions of hours of edge-case hardening that a widely used library accumulates. If you need an exotic widget that is not among the 60, you build it, on the same primitives, rather than `npm install`-ing it in an afternoon.

What you get back is ownership. No major-version migrations dictated by someone else's roadmap. No dependency that can change behavior under you. No styling you cannot reach. For business software, where the component needs are broad but not exotic, that is the trade I want, and it is the one RevealUI makes by default.

## Own every line

The component layer is MIT licensed, like the rest of RevealUI's core. It ships with every `npx create-revealui`, it renders RevealUI's own apps, and you can fork any component in it without asking anyone. The UI your users touch should be code you control. This is that code.

Build your business, not your boilerplate.

---

*RevealUI is the open runtime for businesses that run their own AI. The component layer is MIT licensed and ships with every install. Get started with `npx create-revealui`, or read the [docs](https://docs.revealui.com).*
