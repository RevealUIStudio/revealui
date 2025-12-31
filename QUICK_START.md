# Quick Start Guide

Get RevealUI Framework up and running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.20.2+ or 20.9.0+ installed
- **pnpm** 9.14.2+ installed ([Install pnpm](https://pnpm.io/installation))
- Accounts for:
  - [Vercel](https://vercel.com) (for database and storage)
  - [Stripe](https://stripe.com) (for payments - test mode is fine)

## Step 1: Clone and Install (1 minute)

```bash
# Clone the repository
git clone https://github.com/RevealUIStudio/reveal.git
cd reveal

# Install dependencies
pnpm install
```

## Step 2: Set Up Environment Variables (3 minutes)

### Generate a Secret

First, generate a secure secret for PayloadCMS:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output - you'll need it for `PAYLOAD_SECRET`.

### Get Vercel Credentials

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new project or use an existing one
3. Go to **Storage** → **Blob** → Create a new token (copy the token)
4. Go to **Storage** → **Postgres** → Create a database (copy the connection string)

### Get Stripe Credentials

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test Mode**
3. Go to **Developers** → **API Keys**
4. Copy your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)
5. Go to **Developers** → **Webhooks** → Add endpoint → Copy webhook signing secret

### Create Environment File

Create `.env.development.local` in the project root:

```bash
# Copy from template if it exists
cp .env.template .env.development.local
```

Or create it manually with these minimum required variables:

```env
# PayloadCMS Configuration
PAYLOAD_SECRET=your_generated_secret_here
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
PAYLOAD_WHITELISTORIGINS=http://localhost:3000,http://localhost:4000

# Database (use your Vercel Postgres connection string)
POSTGRES_URL=postgres://user:password@host:5432/database

# Storage (use your Vercel Blob token)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXX

# Stripe (use your test mode keys)
STRIPE_SECRET_KEY=sk_test_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY=1
```

## Step 3: Start Development Server (1 minute)

```bash
# Start all services (CMS + Web)
pnpm dev

# Or start individually:
# pnpm start:cms  # CMS on http://localhost:4000
# pnpm start:web  # Web on http://localhost:3000
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

### "Cannot connect to database"

- Verify your `POSTGRES_URL` is correct
- Check that your Vercel Postgres database is active
- Ensure the connection string includes credentials

### "Blob storage error"

- Verify your `BLOB_READ_WRITE_TOKEN` is correct
- Check the token has "Read & Write" permissions in Vercel
- Ensure the token hasn't expired

### "PayloadCMS authentication error"

- Verify `PAYLOAD_SECRET` is set and is 32+ characters
- Check that `PAYLOAD_PUBLIC_SERVER_URL` matches your local URL
- Restart the development server after changing environment variables

### Port already in use

If port 4000 or 3000 is already in use:

```bash
# For CMS (default: 4000)
PORT=4001 pnpm start:cms

# For Web (default: 3000)
PORT=3001 pnpm start:web
```

## Next Steps

Now that you're up and running:

- 📖 Read the [Full Documentation](README.md)
- 🎨 Explore the [Component Library](packages/reveal/README.md)
- 🚀 Check out [Example Projects](examples/)
- 📚 Review [Deployment Guide](docs/DEPLOYMENT-RUNBOOK.md)
- 🤝 Read [Contributing Guidelines](CONTRIBUTING.md)

## Need Help?

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/reveal/discussions)
- 🐛 [Report Issues](https://github.com/RevealUIStudio/reveal/issues)
- 📧 [Email Support](mailto:support@revealui.com)

## Production Deployment

When you're ready to deploy:

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

See [Deployment Runbook](docs/DEPLOYMENT-RUNBOOK.md) for detailed instructions.

---

**Congratulations!** You've successfully set up RevealUI Framework. Happy building! 🚀

