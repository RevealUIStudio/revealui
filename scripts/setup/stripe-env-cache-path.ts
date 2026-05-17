import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '../..');

export const LOCAL_STRIPE_ENV_CACHE_PATH = resolve(
  rootDir,
  'node_modules/.cache/revealui-stripe-env.json',
);
