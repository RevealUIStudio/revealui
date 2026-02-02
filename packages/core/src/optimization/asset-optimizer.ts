/**
 * Asset Optimization
 *
 * Utilities for optimizing images, fonts, CSS, and other assets
 */

/**
 * Image optimization configuration
 */
export interface ImageOptimizationConfig {
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  sizes?: number[]
  deviceSizes?: number[]
  imageSizes?: number[]
  formats?: ('webp' | 'avif')[]
  minimumCacheTTL?: number
  disableStaticImages?: boolean
  dangerouslyAllowSVG?: boolean
}

export const DEFAULT_IMAGE_CONFIG: ImageOptimizationConfig = {
  quality: 75,
  format: 'webp',
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  formats: ['webp'],
  minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  disableStaticImages: false,
  dangerouslyAllowSVG: false,
}

/**
 * Calculate responsive image srcset
 */
export function generateSrcSet(src: string, sizes: number[]): string {
  return sizes.map((size) => `${src}?w=${size} ${size}w`).join(', ')
}

/**
 * Generate sizes attribute
 */
export function generateSizesAttribute(
  breakpoints: Array<{ media: string; size: string }>,
  defaultSize: string = '100vw',
): string {
  const mediaQueries = breakpoints.map((bp) => `${bp.media} ${bp.size}`).join(', ')

  return mediaQueries ? `${mediaQueries}, ${defaultSize}` : defaultSize
}

/**
 * Image format detection
 */
export function getOptimalImageFormat(userAgent: string): 'avif' | 'webp' | 'jpeg' {
  // Check for AVIF support
  if (userAgent.includes('Chrome/9') || userAgent.includes('Edge/9')) {
    return 'avif'
  }

  // Check for WebP support
  if (userAgent.includes('Chrome') || userAgent.includes('Edge') || userAgent.includes('Firefox')) {
    return 'webp'
  }

  return 'jpeg'
}

/**
 * Lazy loading configuration
 */
export interface LazyLoadConfig {
  rootMargin?: string
  threshold?: number | number[]
  loading?: 'lazy' | 'eager'
}

export const DEFAULT_LAZY_LOAD_CONFIG: LazyLoadConfig = {
  rootMargin: '50px',
  threshold: 0.01,
  loading: 'lazy',
}

/**
 * Font optimization
 */
export interface FontOptimizationConfig {
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'
  preload?: boolean
  fallback?: string[]
  subset?: string[]
  weights?: number[]
  styles?: ('normal' | 'italic')[]
}

export const DEFAULT_FONT_CONFIG: FontOptimizationConfig = {
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
  weights: [400, 700],
  styles: ['normal'],
}

/**
 * Generate font-face CSS
 */
export function generateFontFace(
  family: string,
  src: string,
  config: FontOptimizationConfig = {},
): string {
  const { display = 'swap', weights = [400], styles = ['normal'] } = config

  const fontFaces: string[] = []

  for (const weight of weights) {
    for (const style of styles) {
      fontFaces.push(`
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: ${display};
  src: url('${src}') format('woff2');
}`)
    }
  }

  return fontFaces.join('\n')
}

/**
 * Font preload link
 */
export function generateFontPreload(href: string, type: string = 'font/woff2'): string {
  return `<link rel="preload" href="${href}" as="font" type="${type}" crossorigin>`
}

/**
 * CSS optimization
 */
export interface CSSOptimizationConfig {
  minify?: boolean
  autoprefixer?: boolean
  purgecss?: boolean
  cssnano?: boolean
  inlineCritical?: boolean
}

export const DEFAULT_CSS_CONFIG: CSSOptimizationConfig = {
  minify: true,
  autoprefixer: true,
  purgecss: true,
  cssnano: true,
  inlineCritical: true,
}

/**
 * Remove unused CSS selectors
 */
export function removeUnusedCSS(css: string, usedSelectors: string[]): string {
  // Simplified implementation
  // Real implementation would use PostCSS or PurgeCSS
  return css
}

/**
 * Inline critical CSS
 */
export function inlineCriticalCSS(html: string, css: string): string {
  const headEnd = html.indexOf('</head>')
  if (headEnd === -1) return html

  const styleTag = `<style>${css}</style>`
  return html.slice(0, headEnd) + styleTag + html.slice(headEnd)
}

/**
 * SVG optimization
 */
export interface SVGOptimizationConfig {
  removeViewBox?: boolean
  removeXMLNS?: boolean
  removeDimensions?: boolean
  removeComments?: boolean
  removeMetadata?: boolean
  removeTitle?: boolean
  removeDesc?: boolean
  convertColors?: boolean
  removeUselessStrokeAndFill?: boolean
}

export const DEFAULT_SVG_CONFIG: SVGOptimizationConfig = {
  removeViewBox: false,
  removeXMLNS: false,
  removeDimensions: true,
  removeComments: true,
  removeMetadata: true,
  removeTitle: false,
  removeDesc: false,
  convertColors: true,
  removeUselessStrokeAndFill: true,
}

/**
 * Optimize SVG string
 */
export function optimizeSVG(svg: string, config: SVGOptimizationConfig = {}): string {
  let optimized = svg

  const { removeComments = true, removeMetadata = true } = config

  if (removeComments) {
    optimized = optimized.replace(/<!--[\s\S]*?-->/g, '')
  }

  if (removeMetadata) {
    optimized = optimized.replace(/<metadata[\s\S]*?<\/metadata>/g, '')
  }

  // Remove unnecessary whitespace
  optimized = optimized.replace(/>\s+</g, '><').trim()

  return optimized
}

/**
 * Convert SVG to data URI
 */
export function svgToDataURI(svg: string): string {
  const optimized = optimizeSVG(svg)
  const encoded = encodeURIComponent(optimized).replace(/'/g, '%27').replace(/"/g, '%22')

  return `data:image/svg+xml,${encoded}`
}

/**
 * Video optimization
 */
export interface VideoOptimizationConfig {
  poster?: string
  preload?: 'none' | 'metadata' | 'auto'
  formats?: ('mp4' | 'webm' | 'ogg')[]
  quality?: number
}

export const DEFAULT_VIDEO_CONFIG: VideoOptimizationConfig = {
  preload: 'metadata',
  formats: ['webm', 'mp4'],
  quality: 80,
}

/**
 * Generate video element
 */
export function generateVideoElement(
  sources: Array<{ src: string; type: string }>,
  config: VideoOptimizationConfig = {},
): string {
  const { poster, preload = 'metadata' } = config

  const sourceElements = sources
    .map((source) => `<source src="${source.src}" type="${source.type}">`)
    .join('\n  ')

  return `
<video ${poster ? `poster="${poster}"` : ''} preload="${preload}" controls>
  ${sourceElements}
  Your browser does not support the video tag.
</video>`
}

/**
 * Asset compression
 */
export interface CompressionConfig {
  brotli?: boolean
  gzip?: boolean
  level?: number
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  brotli: true,
  gzip: true,
  level: 11, // Maximum compression for static assets
}

/**
 * Check if file should be compressed
 */
export function shouldCompressAsset(filePath: string, size: number): boolean {
  const compressibleExts = ['.js', '.css', '.html', '.svg', '.json', '.xml']
  const ext = filePath.substring(filePath.lastIndexOf('.'))

  // Compress if compressible type and size > 1KB
  return compressibleExts.includes(ext) && size > 1024
}

/**
 * Resource hints
 */
export interface ResourceHint {
  type: 'preload' | 'prefetch' | 'dns-prefetch' | 'preconnect'
  href: string
  as?: string
  crossorigin?: boolean
}

export function generateResourceHint(hint: ResourceHint): string {
  const { type, href, as, crossorigin } = hint

  const attributes = [
    `rel="${type}"`,
    `href="${href}"`,
    as ? `as="${as}"` : '',
    crossorigin ? 'crossorigin' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return `<link ${attributes}>`
}

/**
 * Preload critical assets
 */
export function preloadCriticalAssets(
  assets: Array<{ href: string; as: string; type?: string }>,
): string {
  return assets
    .map((asset) =>
      generateResourceHint({
        type: 'preload',
        href: asset.href,
        as: asset.as,
      }),
    )
    .join('\n')
}

/**
 * Prefetch next page assets
 */
export function prefetchNextPage(hrefs: string[]): string {
  return hrefs
    .map((href) =>
      generateResourceHint({
        type: 'prefetch',
        href,
      }),
    )
    .join('\n')
}

/**
 * DNS prefetch for external resources
 */
export function dnsPrefetch(domains: string[]): string {
  return domains
    .map((domain) =>
      generateResourceHint({
        type: 'dns-prefetch',
        href: domain,
      }),
    )
    .join('\n')
}

/**
 * Preconnect to critical origins
 */
export function preconnect(origins: string[]): string {
  return origins
    .map((origin) =>
      generateResourceHint({
        type: 'preconnect',
        href: origin,
        crossorigin: true,
      }),
    )
    .join('\n')
}

/**
 * Calculate asset priority
 */
export type AssetPriority = 'critical' | 'high' | 'medium' | 'low'

export function getAssetPriority(assetPath: string, isAboveFold: boolean): AssetPriority {
  // Critical: Above fold images, fonts, critical CSS/JS
  if (isAboveFold) {
    return 'critical'
  }

  // High: Fonts, above fold CSS/JS
  if (assetPath.includes('font') || assetPath.endsWith('.css')) {
    return 'high'
  }

  // Medium: Below fold images, async scripts
  if (assetPath.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
    return 'medium'
  }

  // Low: Everything else
  return 'low'
}

/**
 * Generate Next.js Image config
 */
export function generateNextImageConfig(domains: string[] = []): {
  domains: string[]
  deviceSizes: number[]
  imageSizes: number[]
  formats: ('webp' | 'avif')[]
} {
  return {
    domains,
    deviceSizes: DEFAULT_IMAGE_CONFIG.deviceSizes!,
    imageSizes: DEFAULT_IMAGE_CONFIG.imageSizes!,
    formats: DEFAULT_IMAGE_CONFIG.formats!,
  }
}

/**
 * Asset budget configuration
 */
export interface AssetBudget {
  images?: number
  scripts?: number
  styles?: number
  fonts?: number
  total?: number
}

export const DEFAULT_ASSET_BUDGETS: AssetBudget = {
  images: 200 * 1024, // 200KB for images
  scripts: 300 * 1024, // 300KB for scripts
  styles: 50 * 1024, // 50KB for styles
  fonts: 100 * 1024, // 100KB for fonts
  total: 500 * 1024, // 500KB total
}

/**
 * Check asset budgets
 */
export function checkAssetBudgets(
  assets: { type: string; size: number }[],
  budgets: AssetBudget = DEFAULT_ASSET_BUDGETS,
): { exceeded: boolean; violations: string[] } {
  const violations: string[] = []

  const totals = {
    images: 0,
    scripts: 0,
    styles: 0,
    fonts: 0,
    total: 0,
  }

  for (const asset of assets) {
    totals.total += asset.size

    if (asset.type.startsWith('image/')) {
      totals.images += asset.size
    } else if (asset.type === 'text/javascript' || asset.type === 'application/javascript') {
      totals.scripts += asset.size
    } else if (asset.type === 'text/css') {
      totals.styles += asset.size
    } else if (asset.type.includes('font')) {
      totals.fonts += asset.size
    }
  }

  if (budgets.images && totals.images > budgets.images) {
    violations.push(`Images exceed budget: ${totals.images} > ${budgets.images}`)
  }

  if (budgets.scripts && totals.scripts > budgets.scripts) {
    violations.push(`Scripts exceed budget: ${totals.scripts} > ${budgets.scripts}`)
  }

  if (budgets.styles && totals.styles > budgets.styles) {
    violations.push(`Styles exceed budget: ${totals.styles} > ${budgets.styles}`)
  }

  if (budgets.fonts && totals.fonts > budgets.fonts) {
    violations.push(`Fonts exceed budget: ${totals.fonts} > ${budgets.fonts}`)
  }

  if (budgets.total && totals.total > budgets.total) {
    violations.push(`Total assets exceed budget: ${totals.total} > ${budgets.total}`)
  }

  return {
    exceeded: violations.length > 0,
    violations,
  }
}
