/**
 * Vercel Skills Catalog
 *
 * Discovery and search for skills in the Vercel Skills ecosystem (skills.sh).
 */

export {
  type CatalogConfig,
  clearCatalogCache,
  fetchVercelCatalog,
  getTrendingSkills,
} from './vercel-catalog.js'

export {
  getSkillsByCompatibility,
  getSkillsByTag,
  getSkillById,
  searchVercelCatalog,
  type SearchOptions,
} from './catalog-search.js'

export type {
  CatalogMetadata,
  VercelCatalog,
  VercelCatalogSkill,
  VercelSkillSearchResult,
} from './catalog-types.js'
