# Installation

## Prerequisites

Before installing RevealUI, make sure you have:

- **Node.js** 18.20.2+ or 20.9.0+
- **pnpm** 9.14.2+ (recommended) or npm/yarn
- **PostgreSQL** database (Vercel Postgres recommended)
- **Vercel Blob** storage account (for media)

## Quick Install

### Using the CLI

The easiest way to get started is using the RevealUI CLI:

```bash
# Install RevealUI CLI globally
pnpm add -g reveal

# Create a new project
reveal init

# Follow the interactive prompts
```

### Manual Installation

1. **Create a new project:**

```bash
mkdir my-revealui-app
cd my-revealui-app
pnpm init
```

2. **Install dependencies:**

```bash
pnpm add reveal react react-dom revealui revealui-react
pnpm add -D typescript @types/react @types/react-dom vite
```

3. **Create `reveal.config.ts`:**

```typescript
import { defineConfig } from "reveal/config";
import react from "reveal/plugins/react";
import vercel from "reveal/plugins/vercel";

export default defineConfig({
  plugins: [react(), vercel()],
});
```

4. **Create your first page:**

Create `src/pages/index.page.tsx`:

```tsx
export default function Page() {
  return <h1>Hello, RevealUI!</h1>;
}
```

5. **Start the dev server:**

```bash
pnpm dev
```

Visit `http://localhost:3000` to see your app!

## Next Steps

- Read the [Quick Start Guide](./quick-start.md)
- Check out [Examples](./examples.md)
- Explore the [API Reference](../api-reference/config.md)

