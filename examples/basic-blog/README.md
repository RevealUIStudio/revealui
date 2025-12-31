# Basic Blog Example

A simple blog built with RevealUI Framework demonstrating:

- Blog post creation and management
- Category organization
- Author profiles
- SEO optimization
- Responsive design

## Features

- ✅ **Blog Posts** - Create, edit, and publish blog posts
- ✅ **Categories** - Organize posts by topic
- ✅ **Authors** - Multi-author support with profiles
- ✅ **SEO** - Meta tags, Open Graph, structured data
- ✅ **Responsive** - Mobile-first design
- ✅ **Dark Mode** - Built-in theme switching

## Quick Start

```bash
# Clone the example
git clone https://github.com/RevealUIStudio/reveal.git
cd reveal/examples/basic-blog

# Install dependencies
pnpm install

# Copy environment template
cp .env.template .env.local

# Edit .env.local with your credentials
# See QUICK_START.md for detailed setup

# Start development server
pnpm dev

# Open http://localhost:3000
```

## Project Structure

```
basic-blog/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── (blog)/         # Blog routes
│   │   ├── admin/          # PayloadCMS admin
│   │   └── api/            # API routes
│   ├── lib/                # Shared utilities
│   └── components/         # React components
├── payload.config.ts       # PayloadCMS configuration
├── next.config.mjs         # Next.js configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

## Customization

### Adding New Post Types

1. Edit `src/lib/collections/Posts.ts`
2. Add new fields to the schema
3. Update the frontend components

### Styling

- Uses Tailwind CSS v4
- Custom theme in `tailwind.config.js`
- Component styles in `src/components/`

### Content Management

- Access admin at `/admin`
- Create posts, categories, and authors
- Manage media uploads

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RevealUIStudio/reveal/tree/main/examples/basic-blog)

### Self-Hosting

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Learn More

- [RevealUI Documentation](https://revealui.com/docs)
- [PayloadCMS Guide](https://payloadcms.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Support

- [GitHub Issues](https://github.com/RevealUIStudio/reveal/issues)
- [Discord Community](https://discord.gg/revealui)
- [Documentation](https://revealui.com/docs)

---

**Built with RevealUI Framework** - Modern React 19 + Next.js 16 + PayloadCMS
