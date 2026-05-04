import { logger } from '@revealui/core/observability/logger';
import { createMiddleware } from 'hono/factory';

/**
 * RevForge domain-lock middleware.
 *
 * When REVFORGE_LICENSED_DOMAIN is set, every incoming request's Host must match
 * the licensed domain or a subdomain of it. Returns 403 otherwise.
 * Skipped entirely when not running in RevForge mode.
 */
export function domainLockMiddleware() {
  const licensedDomain = process.env.REVFORGE_LICENSED_DOMAIN?.trim().toLowerCase();

  if (!licensedDomain) {
    return createMiddleware(async (_c, next) => next());
  }

  logger.info(`RevForge domain-lock active: ${licensedDomain}`);

  return createMiddleware(async (c, next) => {
    const host = (c.req.header('host') ?? '').toLowerCase().split(':')[0];

    const allowed =
      host === licensedDomain ||
      host.endsWith(`.${licensedDomain}`) ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (!allowed) {
      logger.warn('RevForge domain-lock rejected request', {
        host,
        licensedDomain,
      });
      return c.json({ error: 'This RevForge instance is not licensed for this domain.' }, 403);
    }

    return next();
  });
}

/**
 * Validate RevForge environment at startup.
 * Call before starting the HTTP server.
 * Exits the process if required RevForge config is missing or inconsistent.
 */
export function validateRevForgeConfig(): void {
  const licensedDomain = process.env.REVFORGE_LICENSED_DOMAIN?.trim();
  const licenseKey = process.env.REVFORGE_LICENSE_KEY?.trim();

  const isRevForgeMode = Boolean(licensedDomain ?? licenseKey);

  if (!isRevForgeMode) return;

  if (licenseKey && !licensedDomain) {
    const msg =
      'REVFORGE_LICENSE_KEY is set but REVFORGE_LICENSED_DOMAIN is missing. ' +
      'Set REVFORGE_LICENSED_DOMAIN to the domain this RevForge is licensed for.';
    logger.error(msg);
    throw new Error(msg);
  }

  if (licensedDomain && !licenseKey) {
    const msg =
      'REVFORGE_LICENSED_DOMAIN is set but REVFORGE_LICENSE_KEY is missing. ' +
      'A valid license key is required to run RevForge.';
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info('RevForge mode active', { licensedDomain });
}
