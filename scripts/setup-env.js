#!/usr/bin/env node

/**
 * Interactive Environment Setup Script
 *
 * Helps you configure all required environment variables
 * Run: node scripts/setup-env.js
 */

import { randomBytes } from "crypto"
import { existsSync, writeFileSync } from "fs"
import { dirname, resolve } from "path"
import { createInterface } from "readline"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve))

console.log(
  "\n╔══════════════════════════════════════════════════════════════╗"
)
console.log("║                                                              ║")
console.log("║          🔐 ENVIRONMENT SETUP WIZARD                        ║")
console.log("║                                                              ║")
console.log(
  "╚══════════════════════════════════════════════════════════════╝\n"
)

console.log("This wizard will help you create .env.development.local\n")

const envVars = {}

async function setup() {
  // Check if file already exists
  const envPath = resolve(__dirname, "../.env.development.local")
  if (existsSync(envPath)) {
    const overwrite = await question(
      "⚠️  .env.development.local already exists. Overwrite? (y/N): "
    )
    if (overwrite.toLowerCase() !== "y") {
      console.log("\n✅ Setup cancelled. Existing file preserved.\n")
      rl.close()
      return
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("SECTION 1: RevealUI CMS Core")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  // Generate secret automatically
  const secret = randomBytes(32).toString("hex")
  console.log("✅ Generated REVEALUI_SECRET:", secret.substring(0, 20) + "...\n")
  envVars.REVEALUI_SECRET = secret

  envVars.REVEALUI_PUBLIC_SERVER_URL =
    (await question("REVEALUI_PUBLIC_SERVER_URL [http://localhost:4000]: ")) ||
    "http://localhost:4000"

  envVars.NEXT_PUBLIC_SERVER_URL = envVars.REVEALUI_PUBLIC_SERVER_URL

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("SECTION 2: Database")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  console.log("📝 Get from: https://neon.tech → Dashboard → Connection String\n")
  envVars.DATABASE_URL = await question("DATABASE_URL: ")

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("SECTION 3: Vercel Blob Storage")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  console.log(
    "📝 Get from: https://vercel.com/dashboard → Storage → Blob → Create Token\n"
  )
  console.log("⚠️  CRITICAL: Required for media uploads in production!\n")
  envVars.BLOB_READ_WRITE_TOKEN = await question("BLOB_READ_WRITE_TOKEN: ")

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("SECTION 4: Stripe Payments")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  console.log(
    "📝 Get from: https://dashboard.stripe.com → Developers → API Keys\n"
  )
  console.log(
    "💡 Use TEST keys for development (sk_test_... and pk_test_...)\n"
  )

  envVars.STRIPE_SECRET_KEY = await question(
    "STRIPE_SECRET_KEY (sk_test_...): "
  )
  envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = await question(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...): "
  )
  envVars.STRIPE_WEBHOOK_SECRET = await question(
    "STRIPE_WEBHOOK_SECRET (whsec_...): "
  )

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("SECTION 5: Optional - Sentry")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  const useSentry = await question("Configure Sentry error monitoring? (y/N): ")

  if (useSentry.toLowerCase() === "y") {
    console.log("\n📝 Get from: https://sentry.io → Settings → Client Keys\n")
    envVars.NEXT_PUBLIC_SENTRY_DSN = await question("NEXT_PUBLIC_SENTRY_DSN: ")
  }

  // Build .env file content
  let envContent = `# ========================================
# REVEALUI FRAMEWORK - ENVIRONMENT VARIABLES
# ========================================
# Generated: ${new Date().toISOString()}
# DO NOT COMMIT THIS FILE

# ========================================
# CORE - REVEALUI CMS
# ========================================

REVEALUI_SECRET=${envVars.REVEALUI_SECRET}
REVEALUI_PUBLIC_SERVER_URL=${envVars.REVEALUI_PUBLIC_SERVER_URL}
NEXT_PUBLIC_SERVER_URL=${envVars.NEXT_PUBLIC_SERVER_URL}

# ========================================
# DATABASE - NEONDB
# ========================================

DATABASE_URL=${envVars.DATABASE_URL}

# ========================================
# STORAGE - VERCEL BLOB
# ========================================

BLOB_READ_WRITE_TOKEN=${envVars.BLOB_READ_WRITE_TOKEN}

# ========================================
# PAYMENTS - STRIPE
# ========================================

STRIPE_SECRET_KEY=${envVars.STRIPE_SECRET_KEY}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
STRIPE_WEBHOOK_SECRET=${envVars.STRIPE_WEBHOOK_SECRET}

# ========================================
# NODE ENVIRONMENT
# ========================================

NODE_ENV=development
NODE_OPTIONS=--no-deprecation

`

  if (envVars.NEXT_PUBLIC_SENTRY_DSN) {
    envContent += `# ========================================
# ERROR MONITORING - SENTRY
# ========================================

NEXT_PUBLIC_SENTRY_DSN=${envVars.NEXT_PUBLIC_SENTRY_DSN}

`
  }

  // Write file
  try {
    writeFileSync(envPath, envContent)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("✅ SUCCESS!")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    console.log(`✅ Created: .env.development.local`)
    console.log(`✅ Variables configured: ${Object.keys(envVars).length}`)
    console.log("\n🎯 NEXT STEPS:\n")
    console.log("   1. Review .env.development.local")
    console.log("   2. Run: pnpm install")
    console.log("   3. Run: cd apps/cms && pnpm dev")
    console.log("   4. Visit: http://localhost:4000/admin\n")
  } catch (error) {
    console.error("\n❌ Error writing .env file:", error.message)
    process.exit(1)
  }

  rl.close()
}

setup().catch((error) => {
  console.error("\n❌ Setup failed:", error.message)
  rl.close()
  process.exit(1)
})
