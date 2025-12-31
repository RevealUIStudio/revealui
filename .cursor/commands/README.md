# RevealUI Commands

This directory contains Cursor commands for the RevealUI framework.

## Available Commands

### `revealui:scaffold-page`

Scaffold a new RevealUI page with MCP integrations and visual development features.

#### Usage

```bash
# Interactive mode
pnpm scaffold:page

# With arguments
pnpm scaffold:page --name="Dashboard" --route="/dashboard" --template=dashboard --no-mcp
```

#### Options

- `--name=<string>`: Page name (e.g., "Dashboard")
- `--route=<string>`: Route path (e.g., "/dashboard")
- `--template=<string>`: Template type (landing|dashboard|profile|settings) - defaults to "landing"
- `--no-mcp`: Disable MCP features (Vercel/Stripe integrations)

#### Examples

```bash
# Create a landing page
pnpm scaffold:page --name="Home" --route="/"

# Create a dashboard with MCP features
pnpm scaffold:page --name="Analytics" --route="/analytics" --template=dashboard

# Create a profile page without MCP
pnpm scaffold:page --name="Profile" --route="/profile" --template=profile --no-mcp
```

#### Features

- **Visual Templates**: Choose from landing page, dashboard, profile, or settings templates
- **MCP Integration**: Automatically include Vercel deployment and Stripe payment features
- **Type Generation**: Creates TypeScript types and interfaces following project conventions
- **Clean Architecture**: Follows RevealUI's domain/application/infrastructure layer structure
- **Modern UI**: Uses Tailwind CSS with RevealUI's design system

#### Generated Files

- `apps/web/src/app/{route}/page.tsx` - The main page component
- `apps/web/src/lib/types/{route}.ts` - TypeScript types and interfaces (when MCP enabled)

#### Templates

1. **Landing Page**: Hero section with feature cards and MCP demo
2. **Dashboard**: Analytics cards with metrics and MCP integrations
3. **Profile**: User profile form with payment settings
4. **Settings**: Configuration options with integration settings
