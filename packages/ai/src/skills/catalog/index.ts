/**
 * Vercel Skills Catalog
 *
 * Discovery and search for skills in the Vercel Skills ecosystem (skills.sh).
 */

export {
  getSkillById,
  getSkillsByCompatibility,
  getSkillsByTag,
  type SearchOptions,
  searchVercelCatalog,
} from './catalog-search.js';
export type {
  CatalogMetadata,
  VercelCatalog,
  VercelCatalogSkill,
  VercelSkillSearchResult,
} from './catalog-types.js';
export {
  type CatalogConfig,
  clearCatalogCache,
  fetchVercelCatalog,
  getTrendingSkills,
} from './vercel-catalog.js';
