# Stripe Sandbox Setup Guide

This guide explains how to set up Stripe sandboxes (test mode) for RevealUI, following modern Stripe practices.

## Overview

Stripe sandboxes are isolated test environments that allow you to:
- Test payments without real money movement
- Simulate Stripe events safely
- Test webhooks in development
- Experiment with new features

Learn more: [Stripe Sandboxes Documentation](https://docs.stripe.com/sandboxes)

## Required Environment Variables

Your `.env` file needs these Stripe variables:

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Step 1: Get Test API Keys from Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Ensure you're in Test mode** - Check the toggle in the top right (should show "Test mode")
3. Navigate to **Developers → API Keys**
4. Copy your keys:
   - **Publishable key** (starts with `pk_test_`) → Set as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (starts with `sk_test_`) → Set as `STRIPE_SECRET_KEY` (click "Reveal test key")

> **Note:** Always use test keys (`pk_test_...` and `sk_test_...`) for development and sandbox testing.

## Step 2: Set Up Webhook Secret

There are two ways to get a webhook secret depending on your environment:

### Option A: Local Development (Recommended for Sandboxes)

Use Stripe CLI to forward webhooks locally. This is the **modern best practice** for sandbox testing:

1. **Install Stripe CLI** (if not already installed):

   **For WSL2 / Ubuntu / Debian (Recommended method):**

   **Quick install script (recommended):**
   ```bash
   # Use our automated installation script
   ./scripts/setup/stripe-cli-install.sh
   ```
   
   **Manual install via `.deb` package:**
   ```bash
   # Download the latest .deb package for Linux AMD64
   # Visit: https://github.com/stripe/stripe-cli/releases/latest
   # Or use wget with the latest version (replace X.Y.Z with actual version):
   cd ~/Downloads
   wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_X.Y.Z_linux_amd64.deb
   
   # Install the package
   sudo dpkg -i stripe_*_linux_amd64.deb
   
   # Fix any missing dependencies
   sudo apt-get install -f
   
   # Verify installation
   stripe version
   ```
   
   **Alternative: Manual binary installation:**
   ```bash
   # Download the latest tarball
   cd ~/Downloads
   wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_X.Y.Z_linux_x86_64.tar.gz
   
   # Extract
   tar -xzf stripe_*_linux_x86_64.tar.gz
   
   # Move to system PATH
   sudo mv stripe /usr/local/bin/
   sudo chmod +x /usr/local/bin/stripe
   
   # Verify installation
   stripe version
   ```
   
   **For macOS:**
   ```bash
   brew install stripe/stripe-cli/stripe
   ```
   
   **For Windows (PowerShell):**
   ```powershell
   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
   scoop install stripe
   ```

2. **Login to Stripe CLI**:
   ```bash
   stripe login
   ```
   This opens your browser to authorize the CLI with your Stripe account.

3. **Start webhook forwarding**:
   ```bash
   # For CMS app (runs on port 4000 by default)
   stripe listen --forward-to localhost:4000/api/webhooks/stripe
   
   # Alternative: If your CMS runs on a different port, adjust accordingly
   # stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Copy the webhook signing secret**:
   The CLI will output:
   ```
   Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxx (^C to quit)
   ```
   Copy this `whsec_...` value and set it as `STRIPE_WEBHOOK_SECRET` in your `.env` file.

5. **Keep the CLI running** while developing. In a separate terminal, trigger test events:
   ```bash
   stripe trigger payment_intent.succeeded
   stripe trigger checkout.session.completed
   ```

### Option B: Stripe Dashboard Webhook Endpoint (For Production Sandboxes)

If you're testing in a deployed environment or want to use Dashboard webhooks:

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Set the endpoint URL to your webhook handler:
   - Local (using ngrok/tunneling): `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`
   - Production sandbox: `https://your-app.com/api/webhooks/stripe`
4. Select events to listen for:
   - `product.created`
   - `product.updated`
   - `price.created`
   - `price.updated`
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. **Copy the Signing secret** (starts with `whsec_`) from the webhook endpoint details
7. Set it as `STRIPE_WEBHOOK_SECRET` in your `.env` file

> **Security Note:** Each webhook endpoint has a unique signing secret. You'll need different secrets for test and live modes.

## Step 3: Verify Your Configuration

1. **Check your `.env` file** has all three variables set:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. **Restart your development server** to load the new environment variables:
   ```bash
   pnpm dev
   ```

3. **Test the configuration**:
   - Check the health endpoint: `http://localhost:4000/api/health`
   - The Stripe check should show as "healthy" if configured correctly

## Step 4: Test Webhooks Locally

With Stripe CLI running (`stripe listen`), you can trigger test events:

```bash
# Test payment events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed

# Test checkout events
stripe trigger checkout.session.completed

# Test subscription events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
```

These events will be forwarded to your local webhook endpoint. Check your server logs to verify they're received and processed correctly.

## Best Practices for Stripe Sandboxes

1. **Always use test keys** (`pk_test_...`, `sk_test_...`) in development
2. **Use Stripe CLI for local webhook testing** - It's faster and easier than Dashboard webhooks
3. **Never commit real API keys** - Use `.env` files (already in `.gitignore`)
4. **Use separate webhook endpoints** for test and live modes
5. **Verify webhook signatures** - Always validate `Stripe-Signature` header (handled automatically by `protectedStripe.webhooks.constructEvent`)

## WSL2 Specific Notes

If you're using **Windows Subsystem for Linux (WSL2)**, here are important considerations:

### Installation in WSL2

The `.deb` package method works best in WSL2. The CLI runs natively in Linux, so no special Windows setup is needed.

### Port Forwarding

WSL2 networking is transparent for `localhost` connections:
- Use `localhost:4000` (not `127.0.0.1:4000`) when forwarding webhooks
- Your Next.js dev server on `localhost:4000` is accessible from WSL2
- Stripe CLI forwarding will work seamlessly: `stripe listen --forward-to localhost:4000/api/webhooks/stripe`

### Browser Authorization

When running `stripe login`:
- The browser may open in Windows, not WSL2
- This is normal and works fine - the CLI will still authenticate correctly
- If the browser doesn't open automatically, copy the URL from the terminal and paste it into your Windows browser

### Filesystem Performance

- **Recommendation:** Keep your project in the WSL2 filesystem (`~/projects/...`), not in `/mnt/c/...`
- Files in `/mnt/c/...` (Windows drive) are slower due to translation layer
- Stripe CLI works fine from either location, but WSL2 filesystem is faster

### Known Issues in WSL2

- **Hanging on `stripe version` or other commands:**
  - Some users report hanging with certain Stripe CLI versions
  - If this occurs, try an older stable version (e.g., v1.8.11)
  - Monitor the [GitHub issues](https://github.com/stripe/stripe-cli/issues) for fixes

- **Missing dependencies:**
  - The `.deb` installer should handle dependencies automatically
  - If you see missing library errors, run: `sudo apt-get install -f`

### Running Stripe CLI in Background

For long-running webhook forwarding sessions:
```bash
# Run in background (not recommended - use a separate terminal instead)
nohup stripe listen --forward-to localhost:4000/api/webhooks/stripe > stripe-cli.log 2>&1 &

# Or use a terminal multiplexer like tmux
tmux new -s stripe
stripe listen --forward-to localhost:4000/api/webhooks/stripe
# Press Ctrl+B, then D to detach
# Later: tmux attach -t stripe
```

**Best Practice:** Use a separate terminal window/tab for `stripe listen` so you can see webhook events in real-time.

## Troubleshooting

### Error: "Missing signature or webhook secret"

- Ensure `STRIPE_WEBHOOK_SECRET` is set in your `.env` file
- If using Stripe CLI, make sure it's running and you've copied the correct secret
- Restart your dev server after updating `.env`

### Error: "Webhook signature verification failed"

- Verify you're using the correct webhook secret for the endpoint
- Ensure your webhook endpoint matches the URL in `stripe listen` command
- Check that the `Stripe-Signature` header is being passed correctly

### Webhooks not received

- Confirm Stripe CLI is running (`stripe listen`)
- Verify the forward URL matches your webhook endpoint
- Check your server is running and accessible on the correct port
- Review server logs for any errors

### WSL2: Browser not opening for `stripe login`

- This is normal in WSL2 - the browser opens in Windows, not WSL2
- Copy the URL from the terminal and paste it into your Windows browser
- Authentication will work correctly regardless of where the browser runs

### WSL2: Stripe CLI command hangs

- Some versions may have issues in WSL2
- Try an older stable version if the latest hangs
- Check GitHub issues: https://github.com/stripe/stripe-cli/issues/970

## Additional Resources

- [Stripe Sandboxes Documentation](https://docs.stripe.com/sandboxes)
- [Stripe CLI Documentation](https://docs.stripe.com/stripe-cli)
- [Testing Stripe Webhooks](https://docs.stripe.com/webhooks/test)
- [Stripe Testing Guide](https://docs.stripe.com/testing)
