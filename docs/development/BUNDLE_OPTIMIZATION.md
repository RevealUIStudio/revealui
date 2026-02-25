# Bundle Optimization Guide

This guide covers frontend bundle optimization techniques implemented in RevealUI, including bundle size reduction, code splitting, asset optimization, and build performance improvements.

## Table of Contents

- [Overview](#overview)
- [Bundle Analysis](#bundle-analysis)
- [Code Splitting](#code-splitting)
- [Asset Optimization](#asset-optimization)
- [Build Performance](#build-performance)
- [Tree Shaking](#tree-shaking)
- [Compression](#compression)
- [Performance Budgets](#performance-budgets)
- [Best Practices](#best-practices)
- [Benchmarking](#benchmarking)

## Overview

Bundle optimization is critical for:
- Reducing initial page load time
- Improving Time to Interactive (TTI)
- Reducing bandwidth usage
- Better mobile performance
- Improved SEO and Core Web Vitals

Our optimization strategy:
1. **Bundle Analysis** - Understand what's in your bundles
2. **Code Splitting** - Load only what's needed
3. **Asset Optimization** - Optimize images, fonts, CSS
4. **Build Performance** - Faster builds with caching
5. **Tree Shaking** - Remove unused code
6. **Compression** - Reduce transfer size

## Bundle Analysis

Location: `packages/core/src/optimization/bundle-analyzer.ts`

### Analyzing Your Bundle

```bash
# Run bundle analysis
pnpm benchmark:bundle:size

# Analyze specific app
pnpm benchmark:bundle:size -- cms
```

### Using the Bundle Analyzer

```typescript
import { analyzeBundleDirectory, generateBundleReport } from '@revealui/core/optimization/bundle-analyzer'

// Analyze build output
const stats = analyzeBundleDirectory('.next')

// Generate report
const report = generateBundleReport(stats)
console.log(report)

// Get health score
const { score, factors } = getBundleHealthScore(stats)
console.log(`Bundle Health: ${score}/100`)
```

### Bundle Health Metrics

The bundle health score (0-100) is calculated from:

1. **Bundle Size** (40% weight)
   - Excellent: <500KB
   - Good: 500KB-1MB
   - Poor: >1MB

2. **Large Files** (30% weight)
   - Files >100KB are flagged
   - Each large file reduces score by 10 points

3. **Code Splitting** (20% weight)
   - Optimal: ~10 chunks
   - Too few: Not enough splitting
   - Too many: Over-splitting overhead

4. **Dependencies** (10% weight)
   - Duplicate dependencies reduce score
   - Each duplicate -20 points

### Optimization Suggestions

The analyzer provides automatic suggestions:

```typescript
const suggestions = getOptimizationSuggestions(stats)

for (const suggestion of suggestions) {
  console.log(`${suggestion.severity}: ${suggestion.message}`)
  if (suggestion.potentialSavings) {
    console.log(`  Potential savings: ${formatSize(suggestion.potentialSavings)}`)
  }
}
```

## Code Splitting

Location: `packages/core/src/optimization/code-splitting.ts`

### Route-Based Code Splitting

```typescript
import { lazy } from 'react'

// Basic lazy loading
const HomePage = lazy(() => import('./pages/HomePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))

// With retry logic
import { lazyWithRetry } from '@revealui/core/optimization/code-splitting'

const HomePage = lazyWithRetry(() => import('./pages/HomePage'), {
  maxRetries: 3,
  retryDelay: 1000,
})
```

### Component-Based Code Splitting

```typescript
// Split large components
const Chart = lazy(() => import('./components/Chart'))
const Modal = lazy(() => import('./components/Modal'))
const Editor = lazy(() => import('./components/Editor'))

// Use with Suspense
<Suspense fallback={<Loading />}>
  <Chart data={data} />
</Suspense>
```

### Prefetching

```typescript
import { lazyWithPrefetch } from '@revealui/core/optimization/code-splitting'

const { Component: Dashboard, prefetch } = lazyWithPrefetch(
  () => import('./pages/Dashboard')
)

// Prefetch on hover
<Link to="/dashboard" onMouseEnter={prefetch}>
  Dashboard
</Link>
```

### Load on Interaction

```typescript
import { loadOnInteraction } from '@revealui/core/optimization/code-splitting'

const buttonRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
  const cleanup = loadOnInteraction(
    buttonRef.current,
    () => import('./components/Modal'),
    ['click']
  )

  return cleanup
}, [])
```

### Load on Visibility

```typescript
import { prefetchOnVisible } from '@revealui/core/optimization/code-splitting'

const elementRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const cleanup = prefetchOnVisible(
    elementRef.current,
    () => import('./components/Footer'),
    { rootMargin: '50px' }
  )

  return cleanup
}, [])
```

### Vendor Chunk Splitting

```typescript
import { VENDOR_CHUNK_CONFIGS } from '@revealui/core/optimization/code-splitting'

// Automatically splits vendors:
// - react-vendors: React, ReactDOM, React Router
// - ui-vendors: class-variance-authority, clsx
// - utils-vendors: Lodash, date-fns, classnames
// - vendors: All other node_modules
```

### Bundle Budgets

```typescript
import { checkBundleBudgets, DEFAULT_BUDGETS } from '@revealui/core/optimization/code-splitting'

const violations = checkBundleBudgets({
  totalSize: 600 * 1024,
  initialSize: 250 * 1024,
  asyncSizes: [80 * 1024, 120 * 1024],
  cssSize: 55 * 1024,
}, DEFAULT_BUDGETS)

// Default budgets:
// - maxSize: 500KB
// - maxInitialSize: 200KB
// - maxAsyncSize: 100KB
// - maxCSSSize: 50KB
```

## Asset Optimization

Location: `packages/core/src/optimization/asset-optimizer.ts`

### Image Optimization

```typescript
import { DEFAULT_IMAGE_CONFIG } from '@revealui/core/optimization/asset-optimizer'

// Next.js Image configuration
export default {
  images: {
    domains: ['cdn.example.com'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['webp', 'avif'],
    minimumCacheTTL: 31536000, // 1 year
  },
}
```

#### Responsive Images

```typescript
import { generateSrcSet, generateSizesAttribute } from '@revealui/core/optimization/asset-optimizer'

// Generate srcset
const srcset = generateSrcSet('/image.jpg', [640, 1024, 1920])
// /image.jpg?w=640 640w, /image.jpg?w=1024 1024w, /image.jpg?w=1920 1920w

// Generate sizes attribute
const sizes = generateSizesAttribute([
  { media: '(max-width: 768px)', size: '100vw' },
  { media: '(max-width: 1200px)', size: '50vw' },
], '33vw')
```

#### Using Next.js Image

```tsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1920}
  height={1080}
  priority // For LCP image
  placeholder="blur"
  quality={75}
/>
```

### Font Optimization

```typescript
import { generateFontFace, generateFontPreload } from '@revealui/core/optimization/asset-optimizer'

// Generate font-face CSS
const fontFace = generateFontFace('Inter', '/fonts/inter.woff2', {
  display: 'swap',
  weights: [400, 700],
  styles: ['normal'],
})

// Preload critical fonts
const preload = generateFontPreload('/fonts/inter.woff2', 'font/woff2')
```

#### Next.js Font Optimization

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-inter',
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### CSS Optimization

```typescript
// Remove unused CSS
import { removeUnusedCSS } from '@revealui/core/optimization/asset-optimizer'

const optimizedCSS = removeUnusedCSS(css, usedSelectors)

// Inline critical CSS
import { inlineCriticalCSS } from '@revealui/core/optimization/asset-optimizer'

const html = inlineCriticalCSS(htmlContent, criticalCSS)
```

### SVG Optimization

```typescript
import { optimizeSVG, svgToDataURI } from '@revealui/core/optimization/asset-optimizer'

// Optimize SVG
const optimized = optimizeSVG(svgString, {
  removeComments: true,
  removeMetadata: true,
  removeDimensions: true,
})

// Convert to data URI for inlining
const dataURI = svgToDataURI(optimized)
```

### Resource Hints

```typescript
import {
  preloadCriticalAssets,
  prefetchNextPage,
  dnsPrefetch,
  preconnect,
} from '@revealui/core/optimization/asset-optimizer'

// Preload critical resources
preloadCriticalAssets([
  { href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2' },
  { href: '/critical.css', as: 'style' },
])

// DNS prefetch for external domains
dnsPrefetch([
  'https://api.example.com',
  'https://cdn.example.com',
])

// Preconnect to critical origins
preconnect([
  'https://fonts.googleapis.com',
  'https://cdn.example.com',
])

// Prefetch next page
prefetchNextPage(['/about', '/contact'])
```

## Build Performance

Location: `packages/core/src/optimization/build-optimizer.ts`

### Next.js Optimization Config

```typescript
import { DEFAULT_NEXT_CONFIG } from '@revealui/core/optimization/build-optimizer'

// next.config.js
export default {
  ...DEFAULT_NEXT_CONFIG,

  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },

  swcMinify: true,
  outputFileTracing: true,

  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lodash',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },

  productionBrowserSourceMaps: false,
  compress: true,
}
```

### Build Caching

```typescript
// Enable filesystem cache
{
  cache: {
    type: 'filesystem',
    cacheDirectory: '.next/cache',
    compression: 'gzip',
    maxAge: 604800000, // 1 week
  }
}
```

### Parallel Builds

```bash
# Use all CPU cores
pnpm build --parallel

# Specify core count
pnpm build --parallel=4
```

### Build Profiling

```typescript
import { BuildProfiler } from '@revealui/core/optimization/build-optimizer'

const profiler = new BuildProfiler()

profiler.start('build')
profiler.start('compile')
// ... compilation
profiler.end('compile')
profiler.start('optimize')
// ... optimization
profiler.end('optimize')
profiler.end('build')

// Get slowest operations
const slowest = profiler.getSlowestProfiles(10)
```

## Tree Shaking

### Package Configuration

```json
{
  "sideEffects": false
}
```

Or specify files with side effects:

```json
{
  "sideEffects": ["*.css", "*.scss"]
}
```

### Import Strategies

```typescript
// ❌ Bad: Imports entire library
import _ from 'lodash'
import { format } from 'date-fns'

// ✅ Good: Import specific functions
import debounce from 'lodash/debounce'
import map from 'lodash/map'
import format from 'date-fns/format'

// ✅ Best: Use ES modules
import { debounce, map } from 'lodash-es'
```

### Tree-Shakeable Libraries

Use these alternatives for better tree shaking:

| Instead of | Use |
|------------|-----|
| `lodash` | `lodash-es` |
| `moment` | `date-fns` |
| `material-ui` | `@mui/material` with individual imports |
| `antd` | Individual component imports |

## Compression

### Static Asset Compression

```bash
# Pre-compress assets with Brotli (level 11)
find .next/static -type f \( -name '*.js' -o -name '*.css' \) -exec brotli -q 11 -o {}.br {} \;

# Pre-compress with Gzip
find .next/static -type f \( -name '*.js' -o -name '*.css' \) -exec gzip -9 -k {} \;
```

### Runtime Compression

```typescript
// In middleware or API routes
import { compressResponse } from '@revealui/core/api/compression'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  return compressResponse(request, response, {
    level: 6,
    preferBrotli: true,
  })
}
```

### Compression Ratios

Typical compression ratios:

| Asset Type | Gzip | Brotli |
|------------|------|--------|
| JavaScript | 65% | 72% |
| CSS | 75% | 80% |
| JSON | 85% | 88% |
| HTML | 70% | 75% |

## Performance Budgets

### Setting Budgets

```typescript
// Budget configuration
const budgets = {
  maxSize: 500 * 1024, // 500KB total
  maxInitialSize: 200 * 1024, // 200KB initial
  maxAsyncSize: 100 * 1024, // 100KB per async chunk
  maxCSSSize: 50 * 1024, // 50KB CSS
}
```

### Enforcing Budgets

```typescript
import { checkBundleBudgets } from '@revealui/core/optimization/code-splitting'

const violations = checkBundleBudgets(stats, budgets)

if (violations.length > 0) {
  console.error('Bundle budget violations:')
  for (const violation of violations) {
    console.error(`${violation.type}: ${formatSize(violation.exceeded)} over budget`)
  }
  process.exit(1)
}
```

### CI Integration

```yaml
# .github/workflows/bundle-check.yml
- name: Check Bundle Size
  run: |
    pnpm build
    pnpm benchmark:bundle:size
    # Fail if bundle exceeds budget
```

## Best Practices

### 1. Route-Based Code Splitting

Split at the route level for optimal initial load:

```tsx
const routes = [
  {
    path: '/',
    component: lazy(() => import('./pages/HomePage')),
  },
  {
    path: '/about',
    component: lazy(() => import('./pages/AboutPage')),
  },
]
```

### 2. Component-Based Splitting

Split large, rarely-used components:

```tsx
// Heavy components
const Chart = lazy(() => import('./components/Chart'))
const Editor = lazy(() => import('./components/Editor'))
const Calendar = lazy(() => import('./components/Calendar'))
```

### 3. Vendor Splitting

Separate vendor code from application code:

```javascript
// webpack config
splitChunks: {
  cacheGroups: {
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      chunks: 'all',
    },
  },
}
```

### 4. Preload Critical Assets

```html
<!-- In <head> -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/critical.css" as="style">
```

### 5. Lazy Load Images

```tsx
<Image
  src="/image.jpg"
  alt="Description"
  loading="lazy"
  width={800}
  height={600}
/>
```

### 6. Optimize Dependencies

```bash
# Analyze dependencies
npx depcheck

# Find duplicate dependencies
npx npm-check-duplicates

# Analyze bundle composition
npx webpack-bundle-analyzer
```

### 7. Use Modern Formats

- Images: WebP, AVIF
- Fonts: WOFF2
- JavaScript: ES2020+
- CSS: Modern selectors

### 8. Enable Compression

Always enable Brotli for best compression:

```javascript
// next.config.js
{
  compress: true,
  generateEtags: true,
}
```

## Benchmarking

Location: `scripts/performance/benchmark-bundle.ts`

### Running Benchmarks

```bash
# Run all bundle benchmarks
pnpm benchmark:bundle

# Run specific benchmark
pnpm benchmark:bundle:build        # Build performance
pnpm benchmark:bundle:size         # Bundle size
pnpm benchmark:bundle:splitting    # Code splitting
pnpm benchmark:bundle:assets       # Asset optimization
pnpm benchmark:bundle:tree-shaking # Tree shaking
pnpm benchmark:bundle:compression  # Compression
```

### Benchmark Results

Example output:

```
=== Bundle Size Analysis ===

CMS Bundle:
  Total Size: 387.45 KB
  Files: 124
  Large Files: 3
  Health Score: 85/100

  Top 5 Large Files:
    vendors.js: 156.23 KB (40.3%)
    main.js: 98.76 KB (25.5%)
    react-vendors.js: 87.45 KB (22.6%)

=== Code Splitting Effectiveness ===

Chunk Analysis:
  Total Chunks: 12
  Initial Chunks: 3
  Async Chunks: 9

Size Distribution:
  Initial Load: 312.44 KB (70.5%)
  Async Chunks: 130.67 KB (29.5%)

Code Splitting Impact:
  Without splitting: 443.11 KB
  With splitting (30% async loaded): 351.64 KB
  Savings: 91.47 KB (20.6%)

=== Tree Shaking Effectiveness ===

lodash:
  Without: 71.00 KB
  With: 5.00 KB
  Savings: 66.00 KB (93.0%)
  Method: Per-method imports

Total Impact:
  Without tree shaking: 472.00 KB
  With tree shaking: 61.00 KB
  Total savings: 411.00 KB (87.1%)
```

## Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Total Bundle Size | <500KB | <300KB |
| Initial Load | <200KB | <150KB |
| Time to Interactive | <3s | <2s |
| First Contentful Paint | <1.8s | <1s |
| Largest Contentful Paint | <2.5s | <1.5s |
| Cumulative Layout Shift | <0.1 | <0.05 |
| Bundle Health Score | >70 | >85 |

## Troubleshooting

### Large Bundle Size

1. Run bundle analyzer: `pnpm benchmark:bundle:size`
2. Check for duplicate dependencies
3. Verify tree shaking is working
4. Split large components
5. Remove unused dependencies

### Slow Build Times

1. Enable build cache
2. Use parallel builds
3. Upgrade to Turbopack (experimental)
4. Profile build with BuildProfiler
5. Optimize TypeScript configuration

### Poor Code Splitting

1. Review splitChunks configuration
2. Add route-based splitting
3. Split vendor bundles
4. Use dynamic imports
5. Check chunk sizes

## Further Reading

- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [Code Splitting](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
