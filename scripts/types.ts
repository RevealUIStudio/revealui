/**
 * TypeScript types for Rev loop iterative workflow
 */

export interface RevState {
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

export interface RevStateFile {
  frontmatter: RevState
  prompt: string
}

export interface RevStartOptions {
  prompt: string
  maxIterations?: number
  completionPromise?: string
  brutalHonesty?: boolean // Default: true for cohesion workflows
}

/**
 * TypeScript types for Cohesion Engine
 */

export interface PatternInstance {
  file: string
  line: number
  code: string
  context?: {
    before?: string
    after?: string
  }
}

export interface PatternAnalysis {
  pattern: string
  description: string
  instances: PatternInstance[]
  total: number
  variations: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  impact: string
}

export interface Metric {
  name: string
  value: number
  files?: string[]
  percentage?: number
  description?: string
}

export interface CodeLocation {
  file: string
  line: number
  code: string
  context?: {
    before?: string[]
    after?: string[]
  }
}

export interface CohesionIssue {
  id: string
  title: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  impact: string
  description: string
  evidence: CodeLocation[]
  pattern?: string
  count?: number
  recommendation?: string
}

export interface CohesionAnalysis {
  timestamp: string
  issues: CohesionIssue[]
  metrics: Metric[]
  summary: {
    totalIssues: number
    criticalIssues: number
    highIssues: number
    mediumIssues: number
    lowIssues: number
    overallGrade: string
  }
}

export interface FixStrategy {
  id: string
  name: string
  description: string
  targetIssues: string[] // Issue IDs
  safety: {
    requiresTypeCheck: boolean
    requiresBuild: boolean
    requiresTests: boolean
    rollbackSupported: boolean
  }
  apply: (issue: CohesionIssue, dryRun?: boolean) => Promise<FixResult>
}

export interface FixResult {
  success: boolean
  file: string
  changes: CodeChange[]
  errors?: string[]
  warnings?: string[]
}

export interface CodeChange {
  file: string
  line: number
  before: string
  after: string
}

export interface CohesionConfig {
  targetDirectories: string[]
  ignorePatterns: string[]
  fixTypes: string[]
  dryRun: boolean
  maxIssues?: number
}
