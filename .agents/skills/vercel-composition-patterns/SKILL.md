---
name: vercel-composition-patterns
description: React composition patterns for building maintainable, reusable component architectures.
---

# React Composition Patterns

Refer to the official documentation for comprehensive guidance:

- https://react.dev/learn/thinking-in-react
- https://react.dev/learn/passing-data-deeply-with-context
- https://react.dev/reference/react/Children

## Key Points

- Prefer composition over inheritance: pass components as `children` or named slots (render props) rather than building deep class hierarchies
- Use the "children as a prop" pattern to keep parent components flexible; avoid reaching into child internals with refs or imperative handles unless absolutely necessary
- Separate data-fetching (Server Components) from interactivity (Client Components) by wrapping client islands in server-rendered containers
- Lift state up to the nearest common ancestor only when siblings need to share it; otherwise, keep state local to avoid unnecessary re-renders
- Extract reusable UI primitives with explicit, typed prop interfaces; co-locate variants using CVA or similar pattern libraries rather than conditional class concatenation
