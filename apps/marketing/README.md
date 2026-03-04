# RevealUI Marketing Site

Marketing and landing pages for RevealUI - White-Label CMS for Digital Agencies.

## Features

- ✅ Modern, responsive design built with Next.js 16 and Tailwind CSS v4
- ✅ Compelling headline: "White-Label CMS for Digital Agencies"
- ✅ Value propositions highlighting source code access, AI features, and multi-tenant architecture
- ✅ Social proof section with testimonials (placeholders for now)
- ✅ Email waitlist form with API endpoint
- ✅ Ready for Resend/ConvertKit integration

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set the root directory to `apps/marketing`
3. Deploy automatically on push to main branch

### Environment Variables (for email integration)

```env
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## API Endpoints

- `POST /api/waitlist` - Add email to waitlist
- `GET /api/waitlist` - View waitlist (demo only)

## Customization

The landing page is fully customizable. Key components:

- `src/components/HeroSection.tsx` - Main headline and CTA
- `src/components/ValueProposition.tsx` - Feature benefits
- `src/components/SocialProof.tsx` - Testimonials and stats
- `src/components/LeadCapture.tsx` - Email collection form
- `src/components/Footer.tsx` - Footer with links

## Email Integration

The waitlist form currently stores emails in memory. To enable real email sending:

1. Set up a Resend account at https://resend.com
2. Add your API key to environment variables
3. Uncomment the Resend integration code in `src/app/api/waitlist/route.ts`
4. Consider migrating to ConvertKit for newsletter management