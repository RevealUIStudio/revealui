import { getClient } from '@revealui/db';
import type { MiddlewareHandler } from 'hono';

export const dbMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const db = getClient();
    c.set('db', db);
    await next();
  };
};
