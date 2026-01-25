# Monitoring Setup Guide

This document describes how to set up monitoring for RevealUI Framework.

## Overview

RevealUI supports multiple monitoring services:
- **Error Monitoring**: Sentry (already configured)
- **Performance Monitoring**: Vercel Analytics, Speed Insights
- **Application Performance Monitoring (APM)**: Can be extended

## Error Monitoring (Sentry)

### Current Setup

Sentry is already configured in `apps/cms/next.config.mjs`:

```javascript
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = await import('@sentry/nextjs')
  config = withSentryConfig(config, {
    // Sentry configuration
  })
}
```

### Configuration

**Environment Variables:**
```bash
# Sentry DSN (required)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Optional: Sentry organization and project for releases
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# Optional: Sentry auth token for releases
SENTRY_AUTH_TOKEN=your-auth-token
```

**Setup Steps:**
1. Create Sentry account at https://sentry.io
2. Create a new project (Next.js)
3. Copy DSN to `.env` file
4. Restart dev server

### Usage

**Automatic Error Capture:**
Sentry automatically captures:
- Unhandled exceptions
- API route errors
- Next.js errors

**Manual Error Capture:**
```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Code that might fail
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'user-service' },
    extra: { userId: '123' },
  })
}
```

**User Context:**
```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
})
```

### Viewing Errors

1. Go to https://sentry.io
2. Navigate to your project
3. View errors in Issues tab
4. Set up alerts for critical errors

## Performance Monitoring

### Vercel Analytics

**Current Setup:**
Vercel Analytics is configured in `apps/cms/src/instrumentation.ts`:

```typescript
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  const { SpeedInsights } = await import('@vercel/speed-insights/next')
  // Speed Insights is automatically initialized
}
```

**Configuration:**
Automatically enabled when deployed to Vercel.

**Usage:**
- View analytics in Vercel dashboard
- Access performance metrics
- View user analytics

### Speed Insights

**Current Setup:**
Speed Insights is configured in `apps/cms/src/app/layout.tsx`:

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Metrics:**
- Core Web Vitals (LCP, FID, CLS)
- Real User Monitoring (RUM)
- Performance insights

## Application Performance Monitoring (APM)

### Recommended Services

1. **Datadog APM**
   - Application performance monitoring
   - Distributed tracing
   - Custom metrics

2. **New Relic**
   - Full-stack observability
   - Application performance
   - Infrastructure monitoring

3. **Dynatrace**
   - AI-powered APM
   - Automatic discovery
   - Performance insights

### Implementation Example (Datadog)

```typescript
// apps/cms/src/instrumentation.ts
import tracer from 'dd-trace'

export async function register() {
  if (process.env.DD_SERVICE) {
    tracer.init({
      service: 'revealui-cms',
      env: process.env.NODE_ENV,
    })
    tracer.use('http')
    tracer.use('next')
  }
}
```

**Environment Variables:**
```bash
DD_SERVICE=revealui-cms
DD_ENV=production
DD_VERSION=1.0.0
DD_API_KEY=your-api-key
DD_AGENT_HOST=datadog-agent
```

## Logging

See [Logging Strategy](./LOGGING_STRATEGY.md) for detailed logging documentation.

**Key Points:**
- Use structured logging with `@revealui/core/utils/logger`
- Logs automatically captured in production
- Integration with monitoring services

## Health Checks

### API Health Check

```typescript
// apps/cms/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { getClient } from '@revealui/db/client'

export async function GET() {
  try {
    // Check database connection
    const db = getClient()
    await db.query.users.findFirst({ limit: 1 })
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
```

**Usage:**
```bash
curl https://your-domain.com/api/health
```

## Alerts

### Sentry Alerts

1. Go to Sentry project settings
2. Navigate to Alerts
3. Create alert rules:
   - Error rate threshold
   - Critical errors
   - New issues

### Custom Alerts

Use monitoring service APIs to create custom alerts:
- High error rate
- Performance degradation
- Database connection issues
- External service failures

## Monitoring Checklist

### Error Monitoring
- [x] Sentry configured
- [ ] Sentry DSN set in production
- [ ] Alerts configured
- [ ] Error tracking verified

### Performance Monitoring
- [x] Vercel Analytics enabled
- [x] Speed Insights configured
- [ ] Performance baseline established
- [ ] Performance alerts configured

### Logging
- [x] Structured logging implemented
- [x] Logger utility created
- [ ] Log aggregation configured
- [ ] Log retention policy set

### Health Checks
- [ ] Health check endpoint created
- [ ] Monitoring service configured
- [ ] Health check alerts set up

## Best Practices

1. **Monitor Critical Paths**
   - Authentication flows
   - Payment processing
   - Database operations
   - External API calls

2. **Set Appropriate Alerts**
   - Error rate thresholds
   - Performance degradation
   - Service availability

3. **Use Structured Logging**
   - Include context
   - Use appropriate log levels
   - Don't log sensitive data

4. **Regular Reviews**
   - Review error trends
   - Analyze performance metrics
   - Adjust alert thresholds

## Troubleshooting

### Sentry Not Capturing Errors

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set
2. Verify Sentry is initialized
3. Check browser console for errors
4. Review Sentry project settings

### Performance Metrics Missing

1. Verify Vercel Analytics is enabled
2. Check deployment environment
3. Verify Speed Insights component is included
4. Review Vercel dashboard

## Next Steps

1. Configure Sentry in production
2. Set up performance alerts
3. Create health check endpoints
4. Configure log aggregation
5. Set up APM (if needed)
