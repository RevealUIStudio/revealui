import * as environment from './environment.js';
import * as project from './project.js';
import type { ResolverContext, ResolverFn } from './types.js';

export type { ResolverContext, ResolverFn } from './types.js';

const registry = new Map<string, ResolverFn>([
  ['PROJECT_NAME', project.PROJECT_NAME],
  ['PHASE', project.PHASE],
  ['BRANCH_PIPELINE', project.BRANCH_PIPELINE],
  ['LICENSE_TIERS', project.LICENSE_TIERS],
  ['NODE_VERSION', environment.NODE_VERSION],
  ['PACKAGE_MANAGER', environment.PACKAGE_MANAGER],
  ['STACK', environment.STACK],
]);

/** Register a custom resolver. Overwrites existing entries with the same key. */
export function registerResolver(key: string, fn: ResolverFn): void {
  registry.set(key, fn);
}

/** Resolve all `{{PLACEHOLDER}}` markers in a string using the resolver registry. */
export function resolveTemplate(template: string, ctx: ResolverContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const fn = registry.get(key);
    return fn ? fn(ctx) : `{{${key}}}`;
  });
}

/** List all registered resolver keys. */
export function listResolvers(): string[] {
  return [...registry.keys()];
}
