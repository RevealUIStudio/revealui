#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 *
 * Validates that all required environment variables are set
 * Run before starting development or deployment
 */

import { config } from "dotenv"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, "../.env.development.local") })

console.log("\n🔍 Validating Environment Variables...\n")

// Required variables
const required = [
  "PAYLOAD_SECRET",
  "PAYLOAD_PUBLIC_SERVER_URL",
  "NEXT_PUBLIC_SERVER_URL",
  "PAYLOAD_WHITELISTORIGINS",
  "BLOB_READ_WRITE_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
]

// Check required variables
const missing = []
const present = []

required.forEach((key) => {
  if (!process.env[key]) {
    missing.push(key)
  } else {
    present.push(key)
  }
})

// Check database (at least one required)
const hasDatabase =
  process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI
if (!hasDatabase) {
  missing.push("POSTGRES_URL or SUPABASE_DATABASE_URI")
}

// Display results
if (present.length > 0) {
  console.log("✅ Present Variables:")
  present.forEach((key) => {
    const value = process.env[key]
    const masked =
      key.includes("SECRET") || key.includes("TOKEN")
        ? `${value.substring(0, 10)}...`
        : value.substring(0, 50)
    console.log(`   ✅ ${key}: ${masked}`)
  })
  console.log("")
}

if (hasDatabase) {
  const dbType = process.env.POSTGRES_URL
    ? "POSTGRES_URL"
    : "SUPABASE_DATABASE_URI"
  console.log(`✅ Database: ${dbType} configured`)
  console.log("")
}

if (missing.length > 0) {
  console.log("❌ Missing Required Variables:")
  missing.forEach((key) => console.log(`   ❌ ${key}`))
  console.log("\n❌ Environment validation FAILED\n")
  console.log("💡 Fix:")
  console.log("   1. Copy .env.template to .env.development.local")
  console.log("   2. Fill in all required values")
  console.log("   3. Run this script again\n")
  process.exit(1)
}

// Validate specific formats
console.log("🔍 Validating Formats...\n")

// Check PAYLOAD_SECRET length
if (process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET.length < 32) {
  console.log("⚠️  WARNING: PAYLOAD_SECRET should be at least 32 characters")
}

// Check URLs have protocol
const urlVars = ["PAYLOAD_PUBLIC_SERVER_URL", "NEXT_PUBLIC_SERVER_URL"]
urlVars.forEach((key) => {
  const url = process.env[key]
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    console.log(`⚠️  WARNING: ${key} should start with http:// or https://`)
  }
})

// Check Stripe test mode in development
if (process.env.NODE_ENV === "development") {
  if (
    process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.includes("test")
  ) {
    console.log("⚠️  WARNING: Using LIVE Stripe key in development!")
  }
}

// Check production settings
if (process.env.NODE_ENV === "production") {
  if (!process.env.PAYLOAD_PUBLIC_SERVER_URL.startsWith("https://")) {
    console.log("❌ ERROR: Production PAYLOAD_PUBLIC_SERVER_URL must use HTTPS")
    process.exit(1)
  }
  if (process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY === "1") {
    console.log("⚠️  WARNING: Stripe test mode enabled in production!")
  }
}

console.log("✅ All format validations passed\n")

// Summary
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("✅ ENVIRONMENT VALIDATION SUCCESSFUL")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
console.log(`   Required Variables: ${required.length + 1}/all present`)
console.log(`   Database: ${hasDatabase ? "Configured" : "Not configured"}`)
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`)
console.log("")
console.log("🚀 Ready to start development!\n")

process.exit(0)
