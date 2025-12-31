# E-commerce Example

A full-featured e-commerce store built with RevealUI Framework demonstrating:

- Product catalog management
- Shopping cart functionality
- Order processing
- Payment integration (Stripe)
- Customer accounts
- Admin dashboard

## Features

- ✅ **Product Management** - Create, edit, and organize products
- ✅ **Shopping Cart** - Add/remove items, quantity management
- ✅ **Checkout Process** - Secure payment with Stripe
- ✅ **User Accounts** - Registration, login, order history
- ✅ **Admin Dashboard** - Manage products, orders, customers
- ✅ **Inventory Tracking** - Stock management and alerts
- ✅ **SEO Optimized** - Product pages, meta tags, structured data
- ✅ **Responsive Design** - Mobile-first e-commerce experience

## Quick Start

```bash
# Clone the example
git clone https://github.com/RevealUIStudio/reveal.git
cd reveal/examples/e-commerce

# Install dependencies
pnpm install

# Copy environment template
cp .env.template .env.local

# Configure Stripe (required for payments)
# Get your keys from https://dashboard.stripe.com/apikeys
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Configure database
DATABASE_URL=postgresql://...

# Start development server
pnpm dev

# Open http://localhost:3000
```

## Project Structure

```
e-commerce/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── (shop)/         # Public shop routes
│   │   │   ├── products/   # Product pages
│   │   │   ├── cart/       # Shopping cart
│   │   │   └── checkout/   # Checkout process
│   │   ├── admin/          # Admin dashboard
│   │   └── api/            # API routes
│   ├── lib/                # Shared utilities
│   │   ├── stripe/         # Payment processing
│   │   ├── auth/           # Authentication
│   │   └── db/             # Database utilities
│   └── components/         # React components
│       ├── cart/           # Cart components
│       ├── products/       # Product components
│       └── checkout/       # Checkout components
├── payload.config.ts       # PayloadCMS configuration
├── next.config.mjs         # Next.js configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

## Key Components

### Product Management
- **Product Schema**: Name, description, price, images, variants
- **Category System**: Hierarchical product organization
- **Inventory Tracking**: Stock levels and low-stock alerts
- **SEO Fields**: Meta descriptions, Open Graph images

### Shopping Cart
- **Session Storage**: Persistent cart across browser sessions
- **Quantity Management**: Add, remove, update quantities
- **Price Calculation**: Subtotal, tax, shipping, total
- **Guest Checkout**: No account required

### Payment Processing
- **Stripe Integration**: Secure payment processing
- **Multiple Payment Methods**: Cards, digital wallets
- **Webhook Handling**: Order confirmation and updates
- **Receipt Generation**: Automated email receipts

### User Accounts
- **Registration/Login**: Email and password authentication
- **Order History**: Past purchases and tracking
- **Address Management**: Shipping and billing addresses
- **Profile Management**: Account settings and preferences

## Customization

### Adding New Product Types
1. Edit `src/lib/collections/Products.ts`
2. Add new fields to the schema
3. Update the frontend components
4. Configure admin interface

### Payment Methods
1. Configure Stripe webhooks
2. Add new payment providers
3. Customize checkout flow
4. Handle payment failures

### Styling
- Uses Tailwind CSS v4
- Custom e-commerce theme
- Component variants for different layouts
- Dark mode support

## Deployment

### Vercel (Recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RevealUIStudio/reveal/tree/main/examples/e-commerce)

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# Optional
NEXT_PUBLIC_APP_URL=https://yourstore.com
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Self-Hosting
```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Security Considerations

- **Payment Security**: PCI DSS compliance via Stripe
- **Data Protection**: GDPR-compliant data handling
- **Authentication**: Secure session management
- **Input Validation**: All user inputs validated
- **Rate Limiting**: API endpoints protected

## Performance Optimization

- **Image Optimization**: Next.js Image component
- **Caching**: Redis for session storage
- **CDN**: Static assets via Vercel Edge Network
- **Database**: Optimized queries and indexing

## Learn More

- [RevealUI Documentation](https://revealui.com/docs)
- [Stripe Integration Guide](https://stripe.com/docs)
- [PayloadCMS E-commerce](https://payloadcms.com/docs)
- [Next.js E-commerce](https://nextjs.org/docs)

## Support

- [GitHub Issues](https://github.com/RevealUIStudio/reveal/issues)
- [Discord Community](https://discord.gg/revealui)
- [Documentation](https://revealui.com/docs)

---

**Built with RevealUI Framework** - Modern React 19 + Next.js 16 + PayloadCMS + Stripe
