import { logger } from '@revealui/core/observability/logger';
import { createMiddleware } from 'hono/factory';

/**
 * Forge domain-lock middleware.
 *
 * When FORGE_LICENSED_DOMAIN is set, every incoming request's Host must match
 * the licensed domain or a subdomain of it. Returns 403 otherwise.
 * Skipped entirely when not running in Forge mode.
 */
export function domainLockMiddleware() {
  const licensedDomain = process.env.FORGE_LICENSED_DOMAIN?.trim().toLowerCase();

  if (!licensedDomain) {
    return createMiddleware(async (_c, next) => next());
  }

  logger.info(`Forge domain-lock active: ${licensedDomain}`);

  return createMiddleware(async (c, next) => {
    const host = (c.req.header('host') ?? '').toLowerCase().split(':')[0];

    const allowed =
      host === licensedDomain ||
      host.endsWith(`.${licensedDomain}`) ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (!allowed) {
      logger.warn('Forge domain-lock rejected request', {
        host,
        licensedDomain,
      });
      return c.json({ error: 'This Forge instance is not licensed for this domain.' }, 403);
    }

    return next();
  });
}

/**
 * Validate Forge environment at startup.
 * Call before starting the HTTP server.
 * Exits the process if required Forge config is missing or inconsistent.
 */
export function validateForgeConfig(): void {
  const licensedDomain = process.env.FORGE_LICENSED_DOMAIN?.trim();
  const licenseKey = process.env.FORGE_LICENSE_KEY?.trim();

  const isForgeMode = Boolean(licensedDomain ?? licenseKey);

  if (!isForgeMode) return;

  if (licenseKey && !licensedDomain) {
    const msg =
      'FORGE_LICENSE_KEY is set but FORGE_LICENSED_DOMAIN is missing. ' +
      'Set FORGE_LICENSED_DOMAIN to the domain this Forge is licensed for.';
    logger.error(msg);
    throw new Error(msg);
  }

  if (licensedDomain && !licenseKey) {
    const msg =
      'FORGE_LICENSED_DOMAIN is set but FORGE_LICENSE_KEY is missing. ' +
      'A valid license key is required to run Forge.';
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info('Forge mode active', { licensedDomain });
}
