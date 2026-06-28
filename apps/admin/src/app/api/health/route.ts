import { getSession } from '@revealui/auth/server';
import config from '@revealui/config';
import { NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTimeMs?: number;
}

/**
 * Enhanced health check endpoint
 * Unauthenticated: returns minimal status only
 * Authenticated (admin/editor): returns full health details with metrics and checks
 */
export async function GET(request: Request) {
  // Auth check  -  unauthenticated requests get minimal status only
  const session = await getSession(request.headers, extractRequestContext(request));
  const isAuthenticated = session?.user?.role === 'admin';

  if (!isAuthenticated) {
    return NextResponse.json({ status: 'healthy' });
  }

  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  // Check database connectivity
  try {
    const dbStartTime = Date.now();
    const revealui = await getRevealUIInstance();

    await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    });

    const dbResponseTime = Date.now() - dbStartTime;
    checks.push({
      name: 'database',
      status: 'healthy',
      message: 'Database connection successful',
      responseTimeMs: dbResponseTime,
    });
  } catch (error) {
    overallStatus = 'unhealthy';
    checks.push({
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
    });
  }

  // Check Stripe API (if configured)
  if (config.stripe.secretKey) {
    const services = await import('@revealui/services').catch(() => null);
    if (services) {
      try {
        const stripeStartTime = Date.now();
        // Simple API call to verify connectivity
        await services.protectedStripe.balance.retrieve();
        const stripeResponseTime = Date.now() - stripeStartTime;

        checks.push({
          name: 'stripe',
          status: 'healthy',
          message: 'Stripe API connection successful',
          responseTimeMs: stripeResponseTime,
        });
      } catch (error) {
        overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
        checks.push({
          name: 'stripe',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Stripe API connection failed',
        });
      }
    } else {
      checks.push({
        name: 'stripe',
        status: 'degraded',
        message: 'Stripe check skipped: @revealui/services (Pro) not installed',
      });
    }
  }

  // System metrics
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

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
  };

  // Determine HTTP status code
  const httpStatus = overallStatus === 'healthy' ? 200 : 503;

  // White-label: RevForge customer kits override the brand identity via
  // REVEALUI_BRAND_NAME or REVEALUI_TENANT_NAME so uptime monitors / status
  // pages show the operator's brand instead of the framework name.
  // `||` not `??`: Compose `${VAR:-}` delivers unset vars as empty strings.
  const brandName =
    process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: `${brandName} Admin`,
      version: process.env.npm_package_version || 'unknown',
      checks,
      metrics,
    },
    { status: httpStatus },
  );
}

/**
 * Liveness probe endpoint
 * Simple check to verify the service is running
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
