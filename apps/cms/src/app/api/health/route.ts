import config from '@revealui/config'
import { getRevealUI } from '@revealui/core'
import { NextResponse } from 'next/server'
import { protectedStripe } from 'services'

export const dynamic = 'force-dynamic'

interface HealthCheck {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  responseTimeMs?: number
}

/**
 * Enhanced health check endpoint
 * Returns comprehensive system status including database, external services, and system metrics
 */
export async function GET(_request: Request) {
  const startTime = Date.now()
  const checks: HealthCheck[] = []
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'

  // Check database connectivity
  try {
    const dbStartTime = Date.now()
    const revealui = await getRevealUI({
      config: config,
    })

    await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    })

    const dbResponseTime = Date.now() - dbStartTime
    checks.push({
      name: 'database',
      status: 'healthy',
      message: 'Database connection successful',
      responseTimeMs: dbResponseTime,
    })
  } catch (error) {
    overallStatus = 'unhealthy'
    checks.push({
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
    })
  }

  // Check Stripe API (if configured)
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripeStartTime = Date.now()
      // Simple API call to verify connectivity
      await protectedStripe.balance.retrieve()
      const stripeResponseTime = Date.now() - stripeStartTime

      checks.push({
        name: 'stripe',
        status: 'healthy',
        message: 'Stripe API connection successful',
        responseTimeMs: stripeResponseTime,
      })
    } catch (error) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus
      checks.push({
        name: 'stripe',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Stripe API connection failed',
      })
    }
  }

  // Check Vercel Blob Storage (if configured)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blobStartTime = Date.now()
      // Vercel Blob doesn't have a simple health check endpoint
      // We'll mark it as healthy if token is configured
      const blobResponseTime = Date.now() - blobStartTime

      checks.push({
        name: 'vercel-blob',
        status: 'healthy',
        message: 'Vercel Blob token configured',
        responseTimeMs: blobResponseTime,
      })
    } catch (error) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus
      checks.push({
        name: 'vercel-blob',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Vercel Blob check failed',
      })
    }
  }

  // System metrics
  const memoryUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()

  const metrics = {
    responseTimeMs: Date.now() - startTime,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    uptime: Math.round(process.uptime()), // seconds
  }

  // Determine HTTP status code
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'RevealUI CMS',
      version: process.env.npm_package_version || 'unknown',
      checks,
      metrics,
    },
    { status: httpStatus },
  )
}

/**
 * Liveness probe endpoint
 * Simple check to verify the service is running
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
