# Portfolio Example

A modern, responsive portfolio website built with RevealUI Framework demonstrating:

- Project showcase with filtering
- Blog integration
- Contact forms
- Resume/CV display
- Dark mode toggle
- Performance optimization

## Features

- ✅ **Project Gallery** - Showcase your work with filtering
- ✅ **Blog Integration** - Share your thoughts and updates
- ✅ **Contact Forms** - Get in touch with visitors
- ✅ **Resume Display** - Professional CV presentation
- ✅ **Dark Mode** - Automatic theme switching
- ✅ **SEO Optimized** - Meta tags, structured data
- ✅ **Performance** - Lighthouse score 95+
- ✅ **Responsive** - Perfect on all devices

## Quick Start

```bash
# Clone the example
git clone https://github.com/RevealUIStudio/reveal.git
cd revealui/examples/portfolio

# Install dependencies
pnpm install

# Copy environment template
cp .env.template .env.local

# Configure contact form (optional)
# Get your keys from your email service provider
EMAIL_SERVICE_API_KEY=your_api_key
EMAIL_SERVICE_DOMAIN=your_domain

# Start development server
pnpm dev

# Open http://localhost:3000
```

## Project Structure

```
portfolio/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── (portfolio)/    # Public portfolio routes
│   │   │   ├── projects/   # Project detail pages
│   │   │   ├── blog/       # Blog posts
│   │   │   ├── about/      # About page
│   │   │   └── contact/    # Contact page
│   │   ├── admin/          # Content management
│   │   └── api/            # API routes
│   ├── lib/                # Shared utilities
│   │   ├── email/          # Contact form handling
│   │   ├── seo/            # SEO utilities
│   │   └── utils/          # Helper functions
│   └── components/         # React components
│       ├── portfolio/      # Portfolio components
│       ├── blog/           # Blog components
│       └── ui/             # UI components
├── revealui.config.ts       # RevealUI CMS configuration
├── next.config.mjs         # Next.js configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

## Key Components

### Portfolio Showcase
- **Project Grid**: Responsive grid layout with filtering
- **Project Details**: Full-page project descriptions
- **Image Gallery**: High-quality project screenshots
- **Technology Tags**: Skills and technologies used
- **Live Links**: Direct links to deployed projects

### Blog Integration
- **Article Management**: Create and edit blog posts
- **Category System**: Organize posts by topic
- **Author Profiles**: Multiple author support
- **Reading Time**: Estimated reading time
- **Social Sharing**: Share buttons for social media

### Contact System
- **Contact Form**: Professional contact form
- **Email Integration**: Automatic email notifications
- **Spam Protection**: reCAPTCHA integration
- **Form Validation**: Client and server-side validation
- **Success/Error States**: User feedback

### Resume/CV Display
- **Professional Layout**: Clean, readable resume format
- **Skills Section**: Technical and soft skills
- **Experience Timeline**: Chronological work history
- **Education**: Academic background
- **Certifications**: Professional certifications
- **Download Option**: PDF download link

## Customization

### Personal Branding
1. Update `src/lib/constants/site.ts` with your information
2. Replace logo and favicon in `public/`
3. Customize color scheme in `tailwind.config.js`
4. Update social media links

### Content Management
1. Access admin at `/admin`
2. Create projects, blog posts, and pages
3. Upload images and media
4. Configure site settings

### Styling
- Uses Tailwind CSS v4
- Custom portfolio theme
- Component variants for different layouts
- Dark mode with system preference detection

## Performance Features

### Optimization
- **Image Optimization**: Next.js Image component with WebP
- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Images and components loaded on demand
- **Caching**: Static generation with ISR
- **CDN**: Global content delivery

### SEO
- **Meta Tags**: Dynamic meta descriptions
- **Open Graph**: Social media previews
- **Structured Data**: JSON-LD for search engines
- **Sitemap**: Automatic XML sitemap generation
- **Robots.txt**: Search engine directives

## Deployment

### Vercel (Recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RevealUIStudio/revealui/tree/main/examples/portfolio)

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://...

# Optional
NEXT_PUBLIC_APP_URL=https://yourportfolio.com
EMAIL_SERVICE_API_KEY=your_api_key
EMAIL_SERVICE_DOMAIN=your_domain
GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
```

### Self-Hosting
```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Analytics & Monitoring

### Built-in Analytics
- **Google Analytics**: Track visitor behavior
- **Vercel Analytics**: Performance monitoring
- **Core Web Vitals**: User experience metrics
- **Error Tracking**: Automatic error reporting

### Custom Metrics
- **Contact Form Submissions**: Track form completions
- **Project Views**: Monitor popular projects
- **Blog Engagement**: Reading time and shares
- **Performance Scores**: Lighthouse metrics

## Accessibility

### WCAG Compliance
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels and descriptions
- **Color Contrast**: WCAG AA compliant colors
- **Focus Management**: Visible focus indicators
- **Alt Text**: Descriptive image alternatives

## Import Paths

This example uses the unified `@revealui/core` package for all types and generated code:

```typescript
// Types
import type { Project, Page } from '@revealui/core/types'
import type { Project } from '@revealui/core/types/cms'

// Generated code
import { ProjectCard } from '@revealui/core/generated/components'
```

**Note**: The former `@revealui/types` and `@revealui/generated` packages were merged into `@revealui/core`. Use `@revealui/core/types` and `@revealui/core/generated` for imports.

## Learn More

- [RevealUI Documentation](https://docs.revealui.com)
- [Next.js Portfolio Guide](https://nextjs.org/docs)
- [RevealUI CMS Content](https://docs.revealui.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Support

- [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)
- [Discourse Community](https://community.revealui.com)
- [Documentation](https://docs.revealui.com)

---

**Built with RevealUI Framework** - Modern React 19 + Next.js 16 + RevealUI CMS
