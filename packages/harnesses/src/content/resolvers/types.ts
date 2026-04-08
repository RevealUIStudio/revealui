export interface ResolverContext {
  projectRoot: string;
  projectName?: string;
  phase?: string;
  packageManager?: string;
  nodeVersion?: string;
}

export type ResolverFn = (ctx: ResolverContext) => string;
