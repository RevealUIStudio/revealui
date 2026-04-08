/**
 * Vercel Skills Catalog Types
 *
 * Type definitions for the skills.sh catalog API.
 */

import { z } from 'zod/v4';

/**
 * A skill entry in the Vercel catalog.
 */
export const VercelCatalogSkillSchema = z.object({
  /** Unique skill identifier (e.g., "vercel-labs/agent-skills/react-best-practices") */
  id: z.string(),

  /** Skill name */
  name: z.string(),

  /** Owner/organization */
  owner: z.string(),

  /** Repository name */
  repo: z.string(),

  /** Path within repo (if monorepo) */
  path: z.string().optional(),

  /** Description */
  description: z.string(),

  /** Installation count */
  installs: z.number().optional(),

  /** Tags/categories */
  tags: z.array(z.string()).optional(),

  /** Compatible tools/frameworks */
  compatibility: z.array(z.string()).optional(),

  /** Last updated timestamp */
  updatedAt: z.string().optional(),

  /** GitHub stars */
  stars: z.number().optional(),

  /** Version */
  version: z.string().optional(),
});
export type VercelCatalogSkill = z.infer<typeof VercelCatalogSkillSchema>;

/**
 * Search result from the catalog.
 */
export const VercelSkillSearchResultSchema = z.object({
  /** Matching skill */
  skill: VercelCatalogSkillSchema,

  /** Relevance score (0-1) */
  score: z.number().min(0).max(1),

  /** Why this skill matched */
  matchReason: z.string().optional(),
});
export type VercelSkillSearchResult = z.infer<typeof VercelSkillSearchResultSchema>;

/**
 * Catalog metadata.
 */
export const CatalogMetadataSchema = z.object({
  /** Total number of skills */
  totalSkills: z.number(),

  /** When catalog was last fetched */
  fetchedAt: z.string().datetime(),

  /** Catalog version */
  version: z.string().optional(),
});
export type CatalogMetadata = z.infer<typeof CatalogMetadataSchema>;

/**
 * Full catalog with metadata.
 */
export const VercelCatalogSchema = z.object({
  /** Catalog metadata */
  metadata: CatalogMetadataSchema,

  /** All skills in the catalog */
  skills: z.array(VercelCatalogSkillSchema),
});
export type VercelCatalog = z.infer<typeof VercelCatalogSchema>;
