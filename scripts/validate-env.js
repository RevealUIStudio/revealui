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
  "REVEALUI_SECRET",
  "REVEALUI_PUBLIC_SERVER_URL",
  "DATABASE_URL",
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

// Check REVEALUI_SECRET length
if (process.env.REVEALUI_SECRET && process.env.REVEALUI_SECRET.length < 32) {
  console.log("⚠️  WARNING: REVEALUI_SECRET should be at least 32 characters")
}

// Check URLs have protocol
const urlVars = ["REVEALUI_PUBLIC_SERVER_URL"]
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
  if (!process.env.REVEALUI_PUBLIC_SERVER_URL.startsWith("https://")) {
    console.log("❌ ERROR: Production REVEALUI_PUBLIC_SERVER_URL must use HTTPS")
    process.exit(1)
  }
}

console.log("✅ All format validations passed\n")

// Summary
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("✅ ENVIRONMENT VALIDATION SUCCESSFUL")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
console.log(`   Required Variables: ${required.length}/all present`)
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`)
console.log("")
console.log("🚀 Ready to start development!\n")

process.exit(0)
