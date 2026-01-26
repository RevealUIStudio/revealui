/**
 * TypeScript types for Ralph-inspired iterative workflow
 */

export interface RalphState {
  active: boolean
  iteration: number
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  max_iterations: number
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  completion_promise: string | null
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  started_at: string
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  prompt_file: string
  // biome-ignore lint/style/useNamingConvention: matches state file schema
  completion_marker: string
}

export interface RalphStateFile {
  frontmatter: RalphState
  prompt: string
}

export interface RalphStartOptions {
  prompt: string
  maxIterations?: number
  completionPromise?: string
  brutalHonesty?: boolean // Default: true for cohesion workflows
}
