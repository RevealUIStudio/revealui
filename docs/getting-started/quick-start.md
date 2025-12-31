# Quick Start Guide

Get up and running with RevealUI in 5 minutes.

> **Note:** This guide is for using the RevealUI framework in a new project. If you're working with the RevealUI Framework monorepo (this repository), see the [root Quick Start Guide](../../QUICK_START.md) instead.

## Step 1: Initialize Project

```bash
reveal init
```

This creates:
- `reveal.config.ts` - Framework configuration
- `src/pages/` - Your pages directory
- `package.json` - Dependencies

## Step 2: Add Plugins

```bash
# Add React plugin (if not included)
reveal add react

# Add PayloadCMS plugin
reveal add payload

# Add Vercel plugin
reveal add vercel
```

## Step 3: Create Your First Page

Create `src/pages/index.page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div>
      <h1>Welcome to RevealUI</h1>
      <p>Your first page is ready!</p>
    </div>
  );
}
```

## Step 4: Add Data Fetching

Create `src/pages/about.page.tsx`:

```tsx
export async function data() {
  return {
    title: "About Us",
    description: "Learn more about our company",
  };
}

export default function AboutPage({ data }) {
  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.description}</p>
    </div>
  );
}
```

## Step 5: Start Development

```bash
pnpm dev
```

Visit `http://localhost:3000` to see your app!

## What's Next?

- Learn about [Routing](../guides/routing.md)
- Explore [Data Fetching](../guides/data-fetching.md)
- Check out [Plugins](../guides/plugins.md)
- See [Installation Guide](./installation.md) for detailed setup
- Check out [Examples](./examples.md) for real-world projects

