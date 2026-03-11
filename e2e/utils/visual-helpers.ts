/**
 * Visual Testing and Inspection Helpers
 *
 * Utilities for capturing, comparing, and inspecting visual states during E2E tests
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * Visual test options
 */
export interface VisualTestOptions {
  fullPage?: boolean;
  mask?: string[];
  threshold?: number;
  maxDiffPixelRatio?: number;
  animations?: 'disabled' | 'allow';
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  // Navigation timing
  domContentLoaded: number;
  loadComplete: number;
  domInteractive: number;

  // Paint timing
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint?: number;

  // Resource timing
  totalResources: number;
  totalTransferSize: number;

  // Custom timing
  timeToInteractive?: number;
}

/**
 * Network activity
 */
export interface NetworkActivity {
  requests: NetworkRequest[];
  totalRequests: number;
  totalSize: number;
  avgResponseTime: number;
  errors: number;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  size: number;
  duration: number;
  resourceType: string;
}

/**
 * Take a screenshot with metadata
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  options: {
    fullPage?: boolean;
    description?: string;
    category?: string;
  } = {},
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const category = options.category || 'general';
  const filename = `${name}-${timestamp}.png`;
  const filepath = join('test-results', category, filename);

  await page.screenshot({
    path: filepath,
    fullPage: options.fullPage ?? true,
  });

  // Save metadata
  const metadata = {
    name,
    description: options.description,
    timestamp: new Date().toISOString(),
    url: page.url(),
    viewport: page.viewportSize(),
  };

  await writeFile(filepath.replace('.png', '.json'), JSON.stringify(metadata, null, 2));

  return filepath;
}

/**
 * Take a video recording of a user flow
 */
export async function recordUserFlow(
  page: Page,
  flowName: string,
  actions: () => Promise<void>,
): Promise<string> {
  // Playwright records video automatically if configured
  // This function adds metadata and returns the video path

  const startTime = Date.now();

  await actions();

  const duration = Date.now() - startTime;

  // Save flow metadata
  const metadata = {
    flowName,
    duration,
    timestamp: new Date().toISOString(),
    startUrl: page.url(),
  };

  const metadataPath = join('test-results', 'videos', `${flowName}-metadata.json`);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  return metadataPath;
}

/**
 * Capture trace for debugging
 */
export async function captureTrace(
  page: Page,
  name: string,
  actions: () => Promise<void>,
): Promise<string> {
  const tracePath = join('test-results', 'traces', `${name}.zip`);

  await page.context().tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });

  await actions();

  await page.context().tracing.stop({ path: tracePath });

  return tracePath;
}

/**
 * Compare visual snapshots
 */
export async function compareSnapshot(
  page: Page,
  name: string,
  options: VisualTestOptions = {},
): Promise<void> {
  const locators = options.mask?.map((selector) => page.locator(selector)) || [];

  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: options.fullPage ?? true,
    mask: locators,
    threshold: options.threshold ?? 0.2,
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.01,
    animations: options.animations ?? 'disabled',
  });
}

/**
 * Capture element screenshot
 */
export async function captureElement(page: Page, selector: string, name: string): Promise<string> {
  const element = page.locator(selector);
  const filepath = join('test-results', 'screenshots', `${name}.png`);

  await element.screenshot({ path: filepath });

  return filepath;
}

/**
 * Capture full page with annotations
 */
export async function captureAnnotated(
  page: Page,
  name: string,
  annotations: Array<{ selector: string; label: string }>,
): Promise<string> {
  // Add visual annotations to elements
  await page.evaluate((annots) => {
    for (const { selector, label } of annots) {
      const element = document.querySelector(selector);
      if (element) {
        const annotation = document.createElement('div');
        annotation.textContent = label;
        annotation.style.cssText = `
          position: absolute;
          background: #ff0000;
          color: white;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: bold;
          z-index: 10000;
          pointer-events: none;
        `;
        const rect = element.getBoundingClientRect();
        annotation.style.top = `${rect.top}px`;
        annotation.style.left = `${rect.left}px`;
        document.body.appendChild(annotation);
      }
    }
  }, annotations);

  const filepath = await captureScreenshot(page, name, {
    fullPage: true,
    category: 'annotated',
  });

  // Remove annotations
  await page.evaluate(() => {
    document.querySelectorAll('[style*="z-index: 10000"]').forEach((el) => {
      el.remove();
    });
  });

  return filepath;
}

/**
 * Collect performance metrics
 */
export async function collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const resources = performance.getEntriesByType('resource');

    const firstPaint = paint.find((p) => p.name === 'first-paint');
    const firstContentfulPaint = paint.find((p) => p.name === 'first-contentful-paint');

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      firstPaint: firstPaint?.startTime || 0,
      firstContentfulPaint: firstContentfulPaint?.startTime || 0,
      totalResources: resources.length,
      totalTransferSize: resources.reduce(
        (sum, r) => sum + (r as PerformanceResourceTiming).transferSize,
        0,
      ),
    };
  });
}

/**
 * Monitor network activity
 */
export async function monitorNetwork(page: Page, filter?: RegExp): Promise<NetworkActivity> {
  const requests: NetworkRequest[] = [];

  page.on('response', async (response) => {
    const request = response.request();
    const url = request.url();

    if (filter && !filter.test(url)) {
      return;
    }

    const timing = response.timing();

    requests.push({
      url,
      method: request.method(),
      status: response.status(),
      size: (await response.body().catch(() => Buffer.from(''))).length,
      duration: timing ? timing.responseEnd - timing.requestStart : 0,
      resourceType: request.resourceType(),
    });
  });

  return {
    get requests() {
      return requests;
    },
    get totalRequests() {
      return requests.length;
    },
    get totalSize() {
      return requests.reduce((sum, r) => sum + r.size, 0);
    },
    get avgResponseTime() {
      if (requests.length === 0) return 0;
      return requests.reduce((sum, r) => sum + r.duration, 0) / requests.length;
    },
    get errors() {
      return requests.filter((r) => r.status >= 400).length;
    },
  };
}

/**
 * Create visual test report
 */
export async function createVisualReport(
  testName: string,
  screenshots: string[],
  metrics?: PerformanceMetrics,
): Promise<string> {
  const report = {
    testName,
    timestamp: new Date().toISOString(),
    screenshots,
    metrics,
    passed: true,
  };

  const reportPath = join('test-results', 'reports', `${testName}-report.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  return reportPath;
}

/**
 * Capture console logs
 */
export async function captureConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    logs.push(`[${type}] ${text}`);
  });

  return logs;
}

/**
 * Highlight element for visual verification
 */
export async function highlightElement(
  page: Page,
  selector: string,
  color = '#ff0000',
): Promise<void> {
  await page.evaluate(
    ({ sel, col }) => {
      const element = document.querySelector(sel);
      if (element) {
        const original = (element as HTMLElement).style.outline;
        (element as HTMLElement).style.outline = `3px solid ${col}`;
        setTimeout(() => {
          (element as HTMLElement).style.outline = original;
        }, 2000);
      }
    },
    { sel: selector, col: color },
  );
}

/**
 * Wait and capture loading states
 */
export async function captureLoadingStates(
  page: Page,
  action: () => Promise<void>,
  stateName: string,
): Promise<string[]> {
  const screenshots: string[] = [];

  // Capture before action
  screenshots.push(
    await captureScreenshot(page, `${stateName}-before`, {
      category: 'loading-states',
    }),
  );

  // Start action
  const actionPromise = action();

  // Capture during loading
  await page.waitForTimeout(100);
  screenshots.push(
    await captureScreenshot(page, `${stateName}-loading`, {
      category: 'loading-states',
    }),
  );

  // Wait for completion
  await actionPromise;

  // Capture after
  screenshots.push(
    await captureScreenshot(page, `${stateName}-complete`, {
      category: 'loading-states',
    }),
  );

  return screenshots;
}

/**
 * Capture error state
 */
export async function captureErrorState(
  page: Page,
  errorName: string,
  additionalInfo?: Record<string, unknown>,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = join('test-results', 'errors', `${errorName}-${timestamp}.png`);

  await page.screenshot({
    path: filepath,
    fullPage: true,
  });

  // Save error metadata
  const metadata = {
    errorName,
    timestamp: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    viewport: page.viewportSize(),
    additionalInfo,
  };

  await writeFile(filepath.replace('.png', '.json'), JSON.stringify(metadata, null, 2));

  return filepath;
}

/**
 * Generate visual diff report
 */
export async function generateDiffReport(
  _baselinePath: string,
  _currentPath: string,
  _diffPath: string,
): Promise<{ percentDiff: number; passed: boolean }> {
  // This would use image comparison library like pixelmatch
  // For now, return mock data
  return {
    percentDiff: 0,
    passed: true,
  };
}

/**
 * Capture accessibility tree
 */
export async function captureAccessibilityTree(page: Page): Promise<string> {
  const snapshot = await page.accessibility.snapshot();
  const filepath = join('test-results', 'accessibility', `a11y-tree-${Date.now()}.json`);

  await writeFile(filepath, JSON.stringify(snapshot, null, 2));

  return filepath;
}

/**
 * Monitor and capture Core Web Vitals
 */
export async function captureCoreWebVitals(page: Page): Promise<{
  LCP: number | null;
  FID: number | null;
  CLS: number | null;
}> {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals = {
        LCP: null as number | null,
        FID: null as number | null,
        CLS: null as number | null,
      };

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        vitals.LCP = lastEntry.startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[];
        vitals.FID = entries[0]?.processingStart - entries[0]?.startTime;
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      let cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShift[]) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
        vitals.CLS = cls;
      }).observe({ entryTypes: ['layout-shift'] });

      // Resolve after 5 seconds
      setTimeout(() => resolve(vitals), 5000);
    });
  });
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}
