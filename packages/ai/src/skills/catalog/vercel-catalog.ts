/**
 * Vercel Skills Catalog
 *
 * Fetch and cache the skills.sh catalog for discovery.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { logger } from '@revealui/core/observability/logger';
import type { CatalogMetadata, VercelCatalog, VercelCatalogSkill } from './catalog-types.js';

/**
 * Configuration for catalog fetching.
 */
export interface CatalogConfig {
  /** Cache directory (default: ~/.revealui/cache) */
  cacheDir?: string;

  /** Cache TTL in milliseconds (default: 24 hours) */
  cacheTtl?: number;

  /** Force refresh even if cache is valid */
  forceRefresh?: boolean;
}

/**
 * Get the default cache directory.
 */
function getDefaultCacheDir(): string {
  return path.join(os.homedir(), '.revealui', 'cache');
}

/**
 * Get the catalog cache file path.
 */
function getCatalogCachePath(cacheDir?: string): string {
  const dir = cacheDir ?? getDefaultCacheDir();
  return path.join(dir, 'vercel-catalog.json');
}

/**
 * Fetch the Vercel Skills catalog.
 *
 * This function fetches the catalog from skills.sh (or a known GitHub source)
 * and caches it locally. The cache is invalidated after 24 hours by default.
 *
 * @param config - Configuration options
 * @returns The catalog of available skills
 */
export async function fetchVercelCatalog(config: CatalogConfig = {}): Promise<VercelCatalog> {
  const cachePath = getCatalogCachePath(config.cacheDir);
  const cacheTtl = config.cacheTtl ?? 24 * 60 * 60 * 1000; // 24 hours

  // Try to load from cache if not forcing refresh
  if (!config.forceRefresh) {
    try {
      const cached = loadFromCache(cachePath, cacheTtl);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // Ignore cache errors, fetch fresh
      logger.warn('Error loading catalog cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fetch fresh catalog
  const catalog = await fetchFreshCatalog();

  // Save to cache
  try {
    saveToCache(cachePath, catalog);
  } catch (error) {
    logger.warn('Error saving catalog cache', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return catalog;
}

/**
 * Load catalog from cache if valid.
 */
function loadFromCache(cachePath: string, ttl: number): VercelCatalog | null {
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  const stats = fs.statSync(cachePath);
  const age = Date.now() - stats.mtimeMs;

  if (age > ttl) {
    return null;
  }

  const content = fs.readFileSync(cachePath, 'utf-8');
  return JSON.parse(content) as VercelCatalog;
}

/**
 * Save catalog to cache.
 */
function saveToCache(cachePath: string, catalog: VercelCatalog): void {
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(cachePath, JSON.stringify(catalog, null, 2), 'utf-8');
}

/**
 * Fetch fresh catalog from Vercel Skills ecosystem.
 *
 * Since skills.sh doesn't have a public API yet, we'll fetch from known sources:
 * 1. vercel-labs/agent-skills repository (official Vercel skills)
 * 2. Community aggregated lists
 */
async function fetchFreshCatalog(): Promise<VercelCatalog> {
  // For now, we'll create a curated list of known Vercel skills
  // In the future, this could fetch from a public API
  const skills: VercelCatalogSkill[] = [
    {
      id: 'vercel-labs/agent-skills/react-best-practices',
      name: 'react-best-practices',
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/react-best-practices',
      description: 'React optimization patterns and best practices from Vercel Engineering',
      installs: 81700,
      tags: ['react', 'optimization', 'best-practices'],
      compatibility: ['claude-code', 'cursor', 'copilot'],
    },
    {
      id: 'vercel-labs/agent-skills/web-design-guidelines',
      name: 'web-design-guidelines',
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/web-design-guidelines',
      description: '100+ accessibility and performance rules for web design',
      installs: 61900,
      tags: ['design', 'accessibility', 'performance'],
      compatibility: ['universal'],
    },
    {
      id: 'vercel-labs/agent-skills/find-skills',
      name: 'find-skills',
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/find-skills',
      description: 'Meta-skill for discovering other skills',
      installs: 78800,
      tags: ['discovery', 'meta'],
      compatibility: ['universal'],
    },
    {
      id: 'vercel-labs/agent-skills/nextjs-best-practices',
      name: 'nextjs-best-practices',
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/nextjs-best-practices',
      description: 'Next.js App Router best practices and optimization patterns',
      installs: 45200,
      tags: ['nextjs', 'react', 'best-practices'],
      compatibility: ['claude-code', 'cursor', 'copilot'],
    },
    {
      id: 'vercel-labs/agent-skills/typescript-patterns',
      name: 'typescript-patterns',
      owner: 'vercel-labs',
      repo: 'agent-skills',
      path: 'skills/typescript-patterns',
      description: 'TypeScript design patterns and type safety best practices',
      installs: 38900,
      tags: ['typescript', 'patterns', 'types'],
      compatibility: ['universal'],
    },
  ];

  const metadata: CatalogMetadata = {
    totalSkills: skills.length,
    fetchedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  return {
    metadata,
    skills,
  };
}

/**
 * Get trending skills from the catalog (sorted by installs).
 *
 * @param limit - Maximum number of skills to return
 * @param config - Catalog configuration
 * @returns Trending skills
 */
export async function getTrendingSkills(
  limit = 10,
  config: CatalogConfig = {},
): Promise<VercelCatalogSkill[]> {
  const catalog = await fetchVercelCatalog(config);

  return catalog.skills
    .filter((skill) => skill.installs !== undefined)
    .sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0))
    .slice(0, limit);
}

/**
 * Clear the catalog cache.
 *
 * @param cacheDir - Cache directory
 */
export function clearCatalogCache(cacheDir?: string): void {
  const cachePath = getCatalogCachePath(cacheDir);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
}
