# Quick Start Guide

Get RevealUI up and running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 24.13.0+ installed
- **pnpm** 10+ installed ([Install pnpm](https://pnpm.io/installation))
- Accounts for:
  - [NeonDB](https://neon.tech) (for database)
  - [Vercel](https://vercel.com) (for storage and deployment)
  - [Stripe](https://stripe.com) (for payments - test mode is fine)

## Step 1: Clone and Install (1 minute)

```bash
# Clone the repository
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui

# Install dependencies
pnpm install
```

## Step 2: Set Up Environment Variables (3 minutes)

### Quick Reference

Create `.env.development.local` in the project root with these 8 required variables:

```bash
# Copy from template
cp .env.template .env.development.local
```

Then add your credentials:

```env
# RevealUI Core (generate secret below)
REVEALUI_SECRET=your_generated_secret_here
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# Database (get from NeonDB dashboard)
POSTGRES_URL=postgresql://user:password@host/database?sslmode=require

# Storage (get from Vercel dashboard)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXX

# Stripe (get from Stripe dashboard - use test mode)
STRIPE_SECRET_KEY=sk_test_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
```

### Get Your Credentials

**Generate REVEALUI_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get other credentials:**
- **NeonDB**: [console.neon.tech](https://console.neon.tech) → Copy connection string
- **Vercel Blob**: [vercel.com/dashboard](https://vercel.com/dashboard) → Storage → Blob → Create token
- **Stripe**: [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys (test mode)

📖 **Need detailed setup instructions?** See [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md) for complete configuration with all optional variables.

## Step 3: Start Development Server (1 minute)

```bash
# Start all services
pnpm dev

# Or start individually:
# pnpm dev:cms  # CMS on http://localhost:4000
# pnpm dev:api  # API on http://localhost:3004
```

## Step 4: Create Your First Admin User

1. Open your browser to `http://localhost:4000/admin`
2. Click **"Create your first user"**
3. Fill in:
   - Email address
   - Password (must be 8+ characters)
   - Confirm password
4. Click **"Create"**

You're now logged in as an admin! 🎉

## Step 5: Verify Everything Works

### Test Media Upload

1. In the admin panel, go to **Media**
2. Click **Upload** and select an image
3. The image should upload successfully to Vercel Blob storage

### Test Database Connection

1. In the admin panel, go to **Posts** or **Pages**
2. Try creating a new post
3. If it saves successfully, your database connection is working!

### Test Stripe Integration (Optional)

1. Go to **Settings** → **Stripe**
2. Verify your API keys are configured
3. Create a test product and price
4. Test the checkout flow

## Troubleshooting

Having issues? See [Troubleshooting Guide](./TROUBLESHOOTING.md) for comprehensive solutions to common problems:

- **Database connection issues** - Connection errors, SSL problems, IP allowlist
- **Environment variable problems** - Missing variables, invalid secrets
- **Build failures** - Module errors, TypeScript errors, deployment issues
- **Port conflicts** - Port already in use, zombie processes
- **Authentication errors** - Login failures, JWT token issues

**Quick fixes**:
- Restart dev server after changing .env files
- Verify connection string includes `?sslmode=require`
- Check `REVEALUI_SECRET` is 32+ characters

For detailed solutions → [Troubleshooting Guide](./TROUBLESHOOTING.md)

## Next Steps

Now that you're up and running:

- 📖 Read the [Full Documentation](./INDEX.md)
- 🎨 Explore the [Component Library](./COMPONENT_CATALOG.md)
- 🚀 Check out [Example Projects](./EXAMPLES.md)
- 📚 Review [Deployment Guide](./CI_CD_GUIDE.md)
- 🤝 Read [Contributing Guidelines](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md)

## Need Help?

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)
- 🐛 [Report Issues](https://github.com/RevealUIStudio/revealui/issues)
- 📧 [Email Support](mailto:support@revealui.com)

## Production Deployment

When you're ready to deploy:

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

See [CI/CD Guide](./CI_CD_GUIDE.md) for detailed instructions.

## Related Documentation

### Essential Guides
- **[Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md)** - Complete environment configuration with quick reference tables
- [Database Guide](./DATABASE.md) - Complete database setup and management
- [CI/CD Guide](./CI_CD_GUIDE.md) - Deployment and production configuration

### Advanced
- [Architecture](./ARCHITECTURE.md) - System design and architecture
- [Package Reference](./REFERENCE.md) - Complete package reference

---

**Congratulations!** You've successfully set up RevealUI. Happy building! 🚀
