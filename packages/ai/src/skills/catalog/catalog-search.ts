/**
 * Vercel Catalog Search
 *
 * Search the skills.sh catalog for skills.
 */

import type { VercelCatalogSkill, VercelSkillSearchResult } from './catalog-types.js';
import { type CatalogConfig, fetchVercelCatalog } from './vercel-catalog.js';

/**
 * Search options.
 */
export interface SearchOptions extends CatalogConfig {
  /** Minimum relevance score (0-1) */
  threshold?: number;

  /** Maximum results to return */
  limit?: number;

  /** Filter by tags */
  tags?: string[];

  /** Filter by compatibility */
  compatibility?: string[];
}

/**
 * Search the Vercel Skills catalog.
 *
 * Performs keyword-based search across skill names, descriptions, and tags.
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Matching skills sorted by relevance
 */
export async function searchVercelCatalog(
  query: string,
  options: SearchOptions = {},
): Promise<VercelSkillSearchResult[]> {
  const catalog = await fetchVercelCatalog(options);
  const queryLower = query.toLowerCase();
  const results: VercelSkillSearchResult[] = [];

  for (const skill of catalog.skills) {
    let score = 0;
    const matchReasons: string[] = [];

    // Check name (highest weight)
    if (skill.name.toLowerCase().includes(queryLower)) {
      score += 10;
      matchReasons.push('name match');
    }

    // Check description (medium weight)
    if (skill.description.toLowerCase().includes(queryLower)) {
      score += 5;
      matchReasons.push('description match');
    }

    // Check tags (medium weight)
    if (skill.tags?.some((tag) => tag.toLowerCase().includes(queryLower))) {
      score += 3;
      matchReasons.push('tag match');
    }

    // Check owner/repo (low weight)
    if (
      skill.owner.toLowerCase().includes(queryLower) ||
      skill.repo.toLowerCase().includes(queryLower)
    ) {
      score += 1;
      matchReasons.push('owner/repo match');
    }

    // Apply tag filter
    if (options.tags && options.tags.length > 0) {
      const hasTag = options.tags.some((tag) =>
        skill.tags?.some((skillTag) => skillTag.toLowerCase() === tag.toLowerCase()),
      );
      if (!hasTag) {
        continue;
      }
    }

    // Apply compatibility filter
    if (options.compatibility && options.compatibility.length > 0) {
      const hasCompat = options.compatibility.some((compat) =>
        skill.compatibility?.some(
          (skillCompat) => skillCompat.toLowerCase() === compat.toLowerCase(),
        ),
      );
      if (!hasCompat) {
        continue;
      }
    }

    // Normalize score to 0-1 range
    const normalizedScore = Math.min(score / 10, 1);

    // Apply threshold
    const threshold = options.threshold ?? 0.1;
    if (normalizedScore >= threshold && score > 0) {
      results.push({
        skill,
        score: normalizedScore,
        matchReason: matchReasons.join(', '),
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Apply limit
  const limit = options.limit ?? 10;
  return results.slice(0, limit);
}

/**
 * Get skills by tag.
 *
 * @param tag - Tag to filter by
 * @param options - Catalog options
 * @returns Skills with the specified tag
 */
export async function getSkillsByTag(
  tag: string,
  options: CatalogConfig = {},
): Promise<VercelCatalogSkill[]> {
  const catalog = await fetchVercelCatalog(options);
  const tagLower = tag.toLowerCase();

  return catalog.skills.filter((skill) => skill.tags?.some((t) => t.toLowerCase() === tagLower));
}

/**
 * Get skills by compatibility.
 *
 * @param compatibility - Compatibility to filter by (e.g., "claude-code")
 * @param options - Catalog options
 * @returns Skills compatible with the specified tool
 */
export async function getSkillsByCompatibility(
  compatibility: string,
  options: CatalogConfig = {},
): Promise<VercelCatalogSkill[]> {
  const catalog = await fetchVercelCatalog(options);
  const compatLower = compatibility.toLowerCase();

  return catalog.skills.filter(
    (skill) =>
      skill.compatibility?.some((c) => c.toLowerCase() === compatLower) ||
      skill.compatibility?.includes('universal'),
  );
}

/**
 * Get a specific skill by ID.
 *
 * @param id - Skill ID (e.g., "vercel-labs/agent-skills/react-best-practices")
 * @param options - Catalog options
 * @returns Skill if found, undefined otherwise
 */
export async function getSkillById(
  id: string,
  options: CatalogConfig = {},
): Promise<VercelCatalogSkill | undefined> {
  const catalog = await fetchVercelCatalog(options);
  return catalog.skills.find((skill) => skill.id === id);
}
