/**
 * Build Performance Optimization
 *
 * Utilities for optimizing build performance and configuration
 */

/**
 * Next.js optimization configuration
 */
export interface NextOptimizationConfig {
  // Compiler options
  compiler?: {
    removeConsole?: boolean | { exclude?: string[] }
    reactRemoveProperties?: boolean | { properties?: string[] }
    styledComponents?: boolean
    emotion?: boolean
  }

  // SWC minification
  swcMinify?: boolean

  // Output file tracing
  outputFileTracing?: boolean

  // Experimental features
  experimental?: {
    optimizeCss?: boolean
    optimizePackageImports?: string[]
    turbotrace?: {
      logLevel?: 'bug' | 'fatal' | 'error' | 'warning' | 'hint' | 'note' | 'suggestions' | 'info'
    }
  }

  // Production optimizations
  productionBrowserSourceMaps?: boolean
  generateEtags?: boolean
  poweredByHeader?: boolean
  compress?: boolean

  // Bundle analyzer
  webpack?: {
    analyze?: boolean
  }
}

export const DEFAULT_NEXT_CONFIG: NextOptimizationConfig = {
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  swcMinify: true,
  outputFileTracing: true,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lodash', 'date-fns', 'recharts', '@radix-ui/react-icons'],
  },
  productionBrowserSourceMaps: false,
  generateEtags: true,
  poweredByHeader: false,
  compress: true,
}

/**
 * Webpack optimization configuration
 */
export interface WebpackOptimizationConfig {
  minimize?: boolean
  minimizer?: string[]
  splitChunks?: {
    chunks?: 'all' | 'async' | 'initial'
    minSize?: number
    maxSize?: number
    minChunks?: number
    maxAsyncRequests?: number
    maxInitialRequests?: number
    automaticNameDelimiter?: string
    cacheGroups?: Record<string, unknown>
  }
  runtimeChunk?: boolean | 'single' | 'multiple'
  moduleIds?: 'natural' | 'named' | 'deterministic'
  chunkIds?: 'natural' | 'named' | 'deterministic'
  concatenateModules?: boolean
  usedExports?: boolean
  sideEffects?: boolean
  providedExports?: boolean
  innerGraph?: boolean
}

export const DEFAULT_WEBPACK_CONFIG: WebpackOptimizationConfig = {
  minimize: true,
  splitChunks: {
    chunks: 'all',
    minSize: 20000,
    maxSize: 244000,
    minChunks: 1,
    maxAsyncRequests: 30,
    maxInitialRequests: 30,
    cacheGroups: {
      defaultVendors: {
        test: /[\\/]node_modules[\\/]/,
        priority: -10,
        reuseExistingChunk: true,
      },
      default: {
        minChunks: 2,
        priority: -20,
        reuseExistingChunk: true,
      },
    },
  },
  runtimeChunk: 'single',
  moduleIds: 'deterministic',
  chunkIds: 'deterministic',
  concatenateModules: true,
  usedExports: true,
  sideEffects: true,
  providedExports: true,
  innerGraph: true,
}

/**
 * Turbopack configuration
 */
export interface TurbopackConfig {
  resolveExtensions?: string[]
  resolveAlias?: Record<string, string>
  rules?: Array<{
    test: RegExp
    use: string[]
  }>
}

export const DEFAULT_TURBOPACK_CONFIG: TurbopackConfig = {
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  resolveAlias: {
    '@': './src',
    '@components': './src/components',
    '@lib': './src/lib',
    '@utils': './src/utils',
  },
}

/**
 * Build cache configuration
 */
export interface BuildCacheConfig {
  type?: 'memory' | 'filesystem'
  cacheDirectory?: string
  compression?: boolean | 'gzip' | 'brotli'
  maxAge?: number
  name?: string
  version?: string
}

export const DEFAULT_CACHE_CONFIG: BuildCacheConfig = {
  type: 'filesystem',
  cacheDirectory: '.next/cache',
  compression: 'gzip',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
}

/**
 * Tree shaking configuration
 */
export interface TreeShakingConfig {
  usedExports?: boolean
  sideEffects?: boolean
  providedExports?: boolean
  innerGraph?: boolean
  mangleExports?: boolean
}

export const DEFAULT_TREE_SHAKING_CONFIG: TreeShakingConfig = {
  usedExports: true,
  sideEffects: true,
  providedExports: true,
  innerGraph: true,
  mangleExports: true,
}

/**
 * Generate package.json sideEffects field
 */
export function generateSideEffectsConfig(includeCSS: boolean = true): boolean | string[] {
  if (!includeCSS) {
    return false
  }

  return ['*.css', '*.scss', '*.sass', '*.less']
}

/**
 * Module resolution configuration
 */
export interface ModuleResolutionConfig {
  extensions?: string[]
  alias?: Record<string, string>
  modules?: string[]
  symlinks?: boolean
  fullySpecified?: boolean
}

export const DEFAULT_MODULE_RESOLUTION: ModuleResolutionConfig = {
  extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  alias: {
    '@': './src',
    '@components': './src/components',
    '@lib': './src/lib',
    '@utils': './src/utils',
    '@hooks': './src/hooks',
    '@types': './src/types',
  },
  modules: ['node_modules'],
  symlinks: true,
  fullySpecified: false,
}

/**
 * Parallel build configuration
 */
export interface ParallelBuildConfig {
  parallel?: boolean | number
  cache?: boolean
  threads?: number
}

export const DEFAULT_PARALLEL_CONFIG: ParallelBuildConfig = {
  parallel: true,
  cache: true,
  threads: 4,
}

/**
 * Performance hints configuration
 */
export interface PerformanceConfig {
  hints?: false | 'warning' | 'error'
  maxEntrypointSize?: number
  maxAssetSize?: number
  assetFilter?: (assetFilename: string) => boolean
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  hints: 'warning',
  maxEntrypointSize: 250000, // 250KB
  maxAssetSize: 250000,
  assetFilter: (assetFilename) => {
    return !assetFilename.endsWith('.map')
  },
}

/**
 * Build statistics
 */
export interface BuildStats {
  duration: number
  entrySize: number
  outputSize: number
  assets: Array<{
    name: string
    size: number
  }>
  chunks: Array<{
    id: string | number
    size: number
    files: string[]
  }>
  errors: string[]
  warnings: string[]
}

/**
 * Analyze build performance
 */
export function analyzeBuildPerformance(stats: BuildStats): {
  score: number
  issues: Array<{
    type: 'error' | 'warning' | 'info'
    message: string
  }>
} {
  const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = []
  let score = 100

  // Check build duration
  if (stats.duration > 60000) {
    issues.push({
      type: 'warning',
      message: `Build time (${(stats.duration / 1000).toFixed(1)}s) is slow. Consider parallel builds.`,
    })
    score -= 10
  }

  // Check output size
  if (stats.outputSize > 1024 * 1024) {
    issues.push({
      type: 'warning',
      message: `Output size (${(stats.outputSize / 1024 / 1024).toFixed(1)}MB) is large. Consider code splitting.`,
    })
    score -= 15
  }

  // Check for large assets
  const largeAssets = stats.assets.filter((a) => a.size > 250000)
  if (largeAssets.length > 0) {
    issues.push({
      type: 'warning',
      message: `${largeAssets.length} assets exceed 250KB. Consider optimization.`,
    })
    score -= 10
  }

  // Check for errors
  if (stats.errors.length > 0) {
    issues.push({
      type: 'error',
      message: `${stats.errors.length} build errors found.`,
    })
    score -= 30
  }

  // Check for warnings
  if (stats.warnings.length > 5) {
    issues.push({
      type: 'warning',
      message: `${stats.warnings.length} build warnings found.`,
    })
    score -= 5
  }

  return {
    score: Math.max(0, score),
    issues,
  }
}

/**
 * Generate tsconfig for optimal builds
 */
export function generateOptimizedTSConfig(): {
  compilerOptions: Record<string, unknown>
} {
  return {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
      paths: {
        '@/*': ['./src/*'],
        '@components/*': ['./src/components/*'],
        '@lib/*': ['./src/lib/*'],
        '@utils/*': ['./src/utils/*'],
      },
    },
  }
}

/**
 * Dependency prebuilding
 */
export interface PrebuildConfig {
  include?: string[]
  exclude?: string[]
  force?: boolean
  entries?: string[]
}

export function shouldPrebuildDependency(
  packageName: string,
  config: PrebuildConfig = {},
): boolean {
  const { include = [], exclude = [] } = config

  if (exclude.includes(packageName)) {
    return false
  }

  if (include.length > 0) {
    return include.includes(packageName)
  }

  // Prebuild large, stable dependencies by default
  const prebuildByDefault = ['react', 'react-dom', 'lodash', 'date-fns', 'zod', '@radix-ui']

  return prebuildByDefault.some((pkg) => packageName.startsWith(pkg))
}

/**
 * Build profiling
 */
export interface BuildProfile {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  children: BuildProfile[]
}

export class BuildProfiler {
  private profiles: Map<string, BuildProfile> = new Map()
  private stack: string[] = []

  start(name: string): void {
    const profile: BuildProfile = {
      name,
      startTime: Date.now(),
      children: [],
    }

    if (this.stack.length > 0) {
      const parentName = this.stack[this.stack.length - 1]
      if (parentName) {
        const parent = this.profiles.get(parentName)
        if (parent) {
          parent.children.push(profile)
        }
      }
    }

    this.profiles.set(name, profile)
    this.stack.push(name)
  }

  end(name: string): void {
    const profile = this.profiles.get(name)
    if (profile) {
      profile.endTime = Date.now()
      profile.duration = profile.endTime - profile.startTime
    }

    const index = this.stack.indexOf(name)
    if (index !== -1) {
      this.stack.splice(index, 1)
    }
  }

  getProfile(name: string): BuildProfile | undefined {
    return this.profiles.get(name)
  }

  getAllProfiles(): BuildProfile[] {
    return Array.from(this.profiles.values()).filter((p) => p.endTime !== undefined)
  }

  getSlowestProfiles(limit: number = 10): BuildProfile[] {
    return this.getAllProfiles()
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, limit)
  }

  reset(): void {
    this.profiles.clear()
    this.stack = []
  }
}

/**
 * Build optimization recommendations
 */
export function getBuildOptimizationRecommendations(stats: BuildStats): string[] {
  const recommendations: string[] = []

  if (stats.duration > 30000) {
    recommendations.push(
      'Enable parallel builds with --parallel flag',
      'Use build cache with filesystem caching',
      'Consider using Turbopack for faster builds',
    )
  }

  if (stats.outputSize > 500000) {
    recommendations.push(
      'Enable code splitting for better chunking',
      'Use dynamic imports for large components',
      'Enable tree shaking in production',
    )
  }

  const largeAssets = stats.assets.filter((a) => a.size > 250000)
  if (largeAssets.length > 0) {
    recommendations.push(
      'Compress large assets with gzip/brotli',
      'Optimize images using next/image',
      'Split large vendor bundles',
    )
  }

  if (stats.chunks.length > 100) {
    recommendations.push(
      'Too many chunks - adjust splitChunks configuration',
      'Increase minSize and minChunks thresholds',
    )
  }

  return recommendations
}
