import type { ResolverFn } from './types.js';

export const PROJECT_NAME: ResolverFn = (ctx) => ctx.projectName ?? 'RevealUI';

export const PHASE: ResolverFn = (ctx) => ctx.phase ?? 'Phase 3 — Launch Preparation';

export const BRANCH_PIPELINE: ResolverFn = () => 'feature/* → develop → test → main (production)';

export const LICENSE_TIERS: ResolverFn = () => 'free | pro | max | enterprise';
