# Routing Guide

RevealUI uses file-based routing similar to Next.js, powered by RevealUI.

## File-Based Routing

Pages are automatically routed based on their file location:

```
src/pages/
  index.page.tsx          → /
  about.page.tsx          → /about
  blog/
    index.page.tsx        → /blog
    [slug].page.tsx       → /blog/:slug
```

## Dynamic Routes

Use brackets `[]` for dynamic segments:

```tsx
// src/pages/users/[id].page.tsx
export default function UserPage({ routeParams }) {
  return <h1>User: {routeParams.id}</h1>;
}
```

## Catch-All Routes

Use `[...slug]` for catch-all routes:

```tsx
// src/pages/docs/[...slug].page.tsx
export default function DocsPage({ routeParams }) {
  return <h1>Docs: {routeParams.slug.join('/')}</h1>;
}
```

## Route Parameters

Access route parameters via `routeParams`:

```tsx
export default function Page({ routeParams }) {
  const { id, slug } = routeParams;
  // ...
}
```

## Programmatic Navigation

Use the `navigate` function:

```tsx
import { navigate } from "reveal/navigate";

function MyComponent() {
  const handleClick = () => {
    navigate("/about");
  };
  
  return <button onClick={handleClick}>Go to About</button>;
}
```

## Prefetching

Prefetch pages for faster navigation:

```tsx
import { prefetch } from "reveal/prefetch";

function Link({ href, children }) {
  const handleMouseEnter = () => {
    prefetch(href);
  };
  
  return <a href={href} onMouseEnter={handleMouseEnter}>{children}</a>;
}
```

## Route Guards

Protect routes with guards:

```tsx
// src/pages/admin/+guard.ts
export { guard }

async function guard(pageContext) {
  const { user } = pageContext;
  if (!user || !user.isAdmin) {
    throw redirect("/login");
  }
}
```

## Redirects

Configure redirects in `reveal.config.ts`:

```typescript
export default defineConfig({
  revealui: {
    redirects: [
      { from: "/old", to: "/new", status: 301 },
      { from: "/legacy/*", to: "/new/*", status: 302 },
    ],
  },
});
```

## Learn More

- [Data Fetching](./data-fetching.md)
- [API Reference](../api-reference/config.md)
- [Deployment](./deployment.md)

