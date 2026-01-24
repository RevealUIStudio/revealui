import { renderMarkdown } from "../utils/markdown";

export function HomePage() {
	const content = `# RevealUI Framework Documentation

Welcome to the RevealUI Framework documentation!

## Quick Links

- [Guides](/guides) - User guides and tutorials
- [API Reference](/api) - Complete API documentation
- [Reference](/reference) - Technical reference

## Getting Started

RevealUI is a production-ready, full-stack React framework that combines the best of modern web development.

### Features

- ⚡ React 19 with Server Components
- 🎨 Tailwind CSS v4
- 📦 Native CMS
- 🔥 Next.js 16 support
- 🗄️ NeonDB + Drizzle ORM
- 🌐 Vercel-optimized

## Documentation Structure

This documentation is organized into several sections:

- **Guides** - Step-by-step tutorials and how-to guides
- **API Reference** - Complete API documentation for all packages
- **Reference** - Technical specifications and configuration options

## Contributing

Found an issue or want to improve the documentation? See our [Contributing Guide](../development/CONTRIBUTING-DOCS.md).
`;

	return <div>{renderMarkdown(content)}</div>;
}
