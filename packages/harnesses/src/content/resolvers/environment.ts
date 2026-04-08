import type { ResolverFn } from './types.js';

export const NODE_VERSION: ResolverFn = (ctx) => ctx.nodeVersion ?? '24';

export const PACKAGE_MANAGER: ResolverFn = (ctx) => ctx.packageManager ?? 'pnpm 10';

export const STACK: ResolverFn = () =>
  'React 19, Next.js 16, Node 24, TypeScript 5.9, Drizzle ORM, Hono, Tailwind v4';
