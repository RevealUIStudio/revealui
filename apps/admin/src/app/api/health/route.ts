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
    // GAP-417 (owner-ruled 2026-07-25): the unauthenticated arm reflects the
    // real overall status CODE so uptime monitors and the kit healthcheck
    // finally see a production audit outage, while leaking zero check detail
    // (public-issue-redaction posture: a bare {status} body either way).
    // Only zero-I/O probes run for anonymous callers — no DB query, no
    // Stripe call, no new anonymous load surface.
    try {
      const { audit } = await import('@revealui/security/server');
      if (process.env.NODE_ENV === 'production' && audit.isInMemoryStorage()) {
        return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
      }
    } catch {
      // Probe unavailable: stay minimal-healthy — the boot rails and the
      // authenticated arm carry the detailed signal.
    }
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

  // Audit storage (GAP-338, #2156 review): this check runs in the ROUTE
  // bundle, so it proves the boot-time storage swap in instrumentation reached
  // the same `audit` singleton the routes resolve — the executable
  // cross-bundle proof. In-memory in production means admin emits (incl.
  // login receipts) evaporate on restart: unhealthy. Dev shells without a DB
  // keep the in-memory sink by design: degraded, not unhealthy.
  try {
    const { audit } = await import('@revealui/security/server');
    const inMemory = audit.isInMemoryStorage();
    if (!inMemory) {
      checks.push({
        name: 'audit-storage',
        status: 'healthy',
        message: 'Persistent audit storage installed (route bundle sees the swap)',
      });
    } else if (process.env.NODE_ENV === 'production') {
      overallStatus = 'unhealthy';
      checks.push({
        name: 'audit-storage',
        status: 'unhealthy',
        message:
          'Audit storage is IN-MEMORY in production — admin audit emits evaporate on restart',
      });
    } else {
      // By-design state (dev shell / test env without a DB): informational
      // check entry only. It must NOT downgrade overallStatus — this route
      // maps every non-healthy overall to 503, and a deliberate dev default
      // is not an outage (the 503 belongs to production in-memory only).
      checks.push({
        name: 'audit-storage',
        status: 'degraded',
        message: 'Audit storage is in-memory (non-production without a DB — by design)',
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      // #2162 review refinement: a probe that cannot even run in PRODUCTION
      // is an anomalous state that must keep its status-code signal — it is
      // the one arm that would otherwise report 200 while the audit surface
      // is unobservable.
      overallStatus = 'unhealthy';
      checks.push({
        name: 'audit-storage',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Audit storage check failed',
      });
    } else {
      // Non-production probe failure stays informational — the audit path is
      // guarded at boot and at write time; a dev shell must not 503 on it.
      checks.push({
        name: 'audit-storage',
        status: 'degraded',
        message: error instanceof Error ? error.message : 'Audit storage check failed',
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
