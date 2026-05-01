/**
 * Auth Routes  -  Public Signup Endpoint
 *
 * POST /api/auth/signup  -  Register a new user account
 *
 * This route is rate-limited and enforces the tier-based user limit
 * (enforceUserLimit middleware is applied in index.ts).
 */

import { isSignupAllowed, signUp } from '@revealui/auth/server';
import { SignUpRequestSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/observability/logger';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';

const app = new Hono();

/**
 * POST /signup
 * Creates a new user account after validating input and checking the signup whitelist.
 */
app.post('/signup', zValidator('json', SignUpRequestSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');

  // Check signup whitelist before attempting creation
  if (!isSignupAllowed(email)) {
    return c.json({ success: false, error: 'Signups are currently restricted' }, 403);
  }

  const result = await signUp(email, password, name, {
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
  });

  if (!result.success) {
    logger.warn('Signup failed', { email, error: result.error });
    return c.json({ success: false, error: result.error }, 400);
  }

  logger.info('New user registered via API', { userId: result.user?.id });
  return c.json({ success: true, user: { id: result.user?.id, email: result.user?.email } }, 201);
});

export default app;
