#!/usr/bin/env tsx

/**
 * Stripe Product & Price Seed Script
 *
 * Defines RevealUI's product catalog as code and syncs to Stripe.
 * Idempotent — safe to run multiple times. Uses metadata keys for deduplication.
 *
 * Usage:
 *   pnpm stripe:seed
 *   pnpm stripe:seed -- --dry-run   # Preview without creating
 */

import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { config } from 'dotenv'

// Load env from root .env
config({ path: resolve(import.meta.dirname, '../../.env') })

// Stripe is installed in packages/services — resolve from there
const require = createRequire(resolve(import.meta.dirname, '../../packages/services/'))
const Stripe = require('stripe').default as typeof import('stripe').default

// ─── Product Catalog ────────────────────────────────────────────────────────

interface ProductDefinition {
  key: string
  name: string
  description: string
  prices: PriceDefinition[]
}

interface PriceDefinition {
  key: string
  unitAmount: number // cents
  currency: string
  interval: 'month' | 'year'
  trialDays?: number
}

const CATALOG: ProductDefinition[] = [
  {
    key: 'revealui_pro',
    name: 'RevealUI Pro',
    description:
      'AI agents, MCP servers, editor integrations, and advanced sync. For professional developers and small teams.',
    prices: [
      {
        key: 'revealui_pro_monthly',
        unitAmount: 4900,
        currency: 'usd',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_pro_yearly',
        unitAmount: 47000,
        currency: 'usd',
        interval: 'year',
        trialDays: 7,
      },
    ],
  },
  {
    key: 'revealui_enterprise',
    name: 'RevealUI Enterprise',
    description:
      'SSO, audit logging, white-label, self-hosted deployment, and priority support. For agencies and enterprise teams.',
    prices: [
      {
        key: 'revealui_enterprise_monthly',
        unitAmount: 29900,
        currency: 'usd',
        interval: 'month',
      },
      {
        key: 'revealui_enterprise_yearly',
        unitAmount: 287000,
        currency: 'usd',
        interval: 'year',
      },
    ],
  },
]

// ─── Logger ─────────────────────────────────────────────────────────────────

const log = {
  header: (msg: string) => console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`),
  info: (msg: string) => console.log(`  ℹ ${msg}`),
  success: (msg: string) => console.log(`  ✓ ${msg}`),
  warn: (msg: string) => console.log(`  ⚠ ${msg}`),
  error: (msg: string) => console.error(`  ✗ ${msg}`),
  env: (key: string, value: string) => console.log(`\n  ${key}=${value}`),
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')

  log.header('RevealUI Stripe Product Seed')

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    log.error('STRIPE_SECRET_KEY is not set. Add it to .env')
    process.exit(1)
  }

  if (!(secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))) {
    log.error('STRIPE_SECRET_KEY must start with sk_test_ or sk_live_')
    process.exit(1)
  }

  if (secretKey.startsWith('sk_live_')) {
    log.warn('Using LIVE Stripe key — products will be created in production!')
    log.info('Press Ctrl+C within 5 seconds to abort...')
    await new Promise((r) => setTimeout(r, 5000))
  }

  if (dryRun) {
    log.info('DRY RUN — no changes will be made to Stripe')
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2026-01-28.clover' })

  // Verify connection
  try {
    await stripe.balance.retrieve()
    log.success('Connected to Stripe')
  } catch (err) {
    log.error(`Failed to connect to Stripe: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const envVars: Record<string, string> = {}

  for (const productDef of CATALOG) {
    log.info('')
    log.info(`Processing: ${productDef.name} (${productDef.key})`)

    // Find existing product by metadata
    const existing = await stripe.products.list({
      limit: 100,
      active: true,
    })
    const existingProduct = existing.data.find(
      (p) => p.metadata.revealui_product_key === productDef.key,
    )

    let product: Stripe.Product

    if (existingProduct) {
      // Update if name/description changed
      if (
        existingProduct.name !== productDef.name ||
        existingProduct.description !== productDef.description
      ) {
        if (dryRun) {
          log.info(`Would update product: ${existingProduct.id}`)
          product = existingProduct
        } else {
          product = await stripe.products.update(existingProduct.id, {
            name: productDef.name,
            description: productDef.description,
          })
          log.success(`Updated product: ${product.id}`)
        }
      } else {
        product = existingProduct
        log.success(`Product exists: ${product.id} (no changes needed)`)
      }
    } else {
      if (dryRun) {
        log.info(`Would create product: ${productDef.name}`)
        continue
      }
      product = await stripe.products.create({
        name: productDef.name,
        description: productDef.description,
        metadata: { revealui_product_key: productDef.key },
      })
      log.success(`Created product: ${product.id}`)
    }

    // Sync prices
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    })

    for (const priceDef of productDef.prices) {
      const matchingPrice = existingPrices.data.find(
        (p) =>
          p.metadata.revealui_price_key === priceDef.key &&
          p.unit_amount === priceDef.unitAmount &&
          p.currency === priceDef.currency &&
          p.recurring?.interval === priceDef.interval,
      )

      if (matchingPrice) {
        log.success(
          `  Price exists: ${matchingPrice.id} (${priceDef.key}: $${(priceDef.unitAmount / 100).toFixed(2)}/${priceDef.interval})`,
        )
        // Track env var for the Pro monthly price
        if (priceDef.key === 'revealui_pro_monthly') {
          envVars.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = matchingPrice.id
        }
        continue
      }

      // Check if there's a stale price with same key but different amount/interval
      const stalePrice = existingPrices.data.find(
        (p) => p.metadata.revealui_price_key === priceDef.key,
      )
      if (stalePrice) {
        if (dryRun) {
          log.info(`  Would archive stale price: ${stalePrice.id}`)
        } else {
          await stripe.prices.update(stalePrice.id, { active: false })
          log.warn(`  Archived stale price: ${stalePrice.id}`)
        }
      }

      if (dryRun) {
        log.info(
          `  Would create price: ${priceDef.key} ($${(priceDef.unitAmount / 100).toFixed(2)}/${priceDef.interval})`,
        )
        continue
      }

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceDef.unitAmount,
        currency: priceDef.currency,
        recurring: { interval: priceDef.interval, trial_period_days: priceDef.trialDays },
        metadata: { revealui_price_key: priceDef.key },
      })

      log.success(
        `  Created price: ${price.id} (${priceDef.key}: $${(priceDef.unitAmount / 100).toFixed(2)}/${priceDef.interval})`,
      )

      if (priceDef.key === 'revealui_pro_monthly') {
        envVars.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = price.id
      }
    }
  }

  // Output env vars
  if (Object.keys(envVars).length > 0) {
    log.header('Add to .env')
    for (const [key, value] of Object.entries(envVars)) {
      log.env(key, value)
    }
  }

  log.info('')
  log.success('Done!')
}

main().catch((err) => {
  log.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
