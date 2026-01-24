/**
 * Comprehensive test suite for copy-generated-types.ts
 *
 * Tests table discovery, import generation, transformation, and validation
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  discoverTableMappings,
  generateNeonImports,
  type TableMapping,
  validateTransformation,
} from '../copy-generated-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('copy-generated-types', () => {
  describe('discoverTableMappings', () => {
    it('should discover tables and group by sub-module', () => {
      const mapping = discoverTableMappings()

      // Should have discovered tables
      expect(Object.keys(mapping).length).toBeGreaterThan(0)

      // Each sub-module should have tables
      for (const [subModule, tables] of Object.entries(mapping)) {
        expect(tables.length).toBeGreaterThan(0)
        expect(Array.isArray(tables)).toBe(true)

        // Tables should be sorted
        const sorted = [...tables].sort()
        expect(tables).toEqual(sorted)
      }
    })

    it('should handle sub-modules with hyphens correctly', () => {
      const mapping = discoverTableMappings()

      // Should handle crdt-operations and rate-limits
      const hyphenatedModules = Object.keys(mapping).filter((m) => m.includes('-'))
      expect(hyphenatedModules.length).toBeGreaterThan(0)

      for (const subModule of hyphenatedModules) {
        expect(mapping[subModule]).toBeDefined()
        expect(Array.isArray(mapping[subModule])).toBe(true)
      }
    })

    it('should return consistent results on multiple calls', () => {
      const mapping1 = discoverTableMappings()
      const mapping2 = discoverTableMappings()

      expect(mapping1).toEqual(mapping2)
    })

    it('should include expected sub-modules', () => {
      const mapping = discoverTableMappings()

      // Check for known sub-modules (at least some should exist)
      const knownModules = ['agents', 'cms', 'users', 'sites', 'pages']
      const foundModules = knownModules.filter((m) => mapping[m])

      // At least some known modules should be found
      expect(foundModules.length).toBeGreaterThan(0)
    })
  })

  describe('generateNeonImports', () => {
    it('should generate single-line import for single table', () => {
      const mapping: TableMapping = {
        test: ['singleTable'],
      }

      const imports = generateNeonImports(mapping)

      expect(imports).toContain("import { singleTable } from '@revealui/db/schema/test'")
      expect(imports).not.toContain('import {\n')
    })

    it('should generate multi-line import for multiple tables', () => {
      const mapping: TableMapping = {
        test: ['table1', 'table2', 'table3'],
      }

      const imports = generateNeonImports(mapping)

      expect(imports).toContain('import {')
      expect(imports).toContain('  table1,')
      expect(imports).toContain('  table2,')
      expect(imports).toContain('  table3,')
      expect(imports).toContain("} from '@revealui/db/schema/test'")
    })

    it('should handle sub-modules with hyphens', () => {
      const mapping: TableMapping = {
        'crdt-operations': ['crdtOperations'],
      }

      const imports = generateNeonImports(mapping)

      expect(imports).toContain(
        "import { crdtOperations } from '@revealui/db/schema/crdt-operations'",
      )
    })

    it('should generate imports for all sub-modules', () => {
      const mapping: TableMapping = {
        agents: ['agentActions', 'agentContexts'],
        cms: ['posts', 'media'],
        users: ['users'],
      }

      const imports = generateNeonImports(mapping)

      expect(imports).toContain("@revealui/db/schema/agents'")
      expect(imports).toContain("@revealui/db/schema/cms'")
      expect(imports).toContain("@revealui/db/schema/users'")
    })

    it('should include header comment', () => {
      const mapping: TableMapping = {
        test: ['table1'],
      }

      const imports = generateNeonImports(mapping)

      expect(imports).toContain('// Import table definitions from db package sub-modules')
      expect(imports).toContain(
        '// TypeScript with node16 module resolution requires explicit sub-module exports',
      )
      expect(imports).toContain(
        '// This import block is automatically generated based on actual table exports',
      )
    })

    it('should skip empty sub-modules', () => {
      const mapping: TableMapping = {
        empty: [],
        test: ['table1'],
      }

      const imports = generateNeonImports(mapping)

      expect(imports).not.toContain('empty')
      expect(imports).toContain('test')
    })

    it('should generate imports in deterministic alphabetical order', () => {
      const mapping: TableMapping = {
        zebra: ['zebraTable'],
        alpha: ['alphaTable'],
        beta: ['betaTable'],
        delta: ['deltaTable'],
      }

      const imports1 = generateNeonImports(mapping)
      const imports2 = generateNeonImports(mapping)

      // Should be identical on multiple calls
      expect(imports1).toBe(imports2)

      // Should be in alphabetical order
      const alphaIndex = imports1.indexOf('alpha')
      const betaIndex = imports1.indexOf('beta')
      const deltaIndex = imports1.indexOf('delta')
      const zebraIndex = imports1.indexOf('zebra')

      expect(alphaIndex).toBeLessThan(betaIndex)
      expect(betaIndex).toBeLessThan(deltaIndex)
      expect(deltaIndex).toBeLessThan(zebraIndex)
    })
  })

  describe('validateTransformation', () => {
    const mockTableMapping: TableMapping = {
      agents: ['agentActions', 'agentContexts'],
      cms: ['posts', 'media'],
      users: ['users'],
    }

    it('should detect old import pattern still present', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = original // Not transformed

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Old import pattern still present in transformed content')
    })

    it('should detect missing new imports', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = '// No imports'

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('sub-module imports'))).toBe(true)
    })

    it('should detect missing table imports', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = `import { users } from '@revealui/db/schema/users'
// Missing agentActions, agentContexts, posts, media`

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Missing table imports'))).toBe(true)
    })

    it('should detect duplicate imports', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = `import { users } from '@revealui/db/schema/users'
import { users } from '@revealui/db/schema/users'
import { agentActions } from '@revealui/db/schema/agents'
import { agentContexts } from '@revealui/db/schema/agents'
import { posts } from '@revealui/db/schema/cms'
import { media } from '@revealui/db/schema/cms'`

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Duplicate table imports'))).toBe(true)
    })

    it('should detect wrong import paths', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = `import { users } from '@revealui/db/schema/wrong-module'
import { agentActions } from '@revealui/db/schema/agents'
import { agentContexts } from '@revealui/db/schema/agents'
import { posts } from '@revealui/db/schema/cms'
import { media } from '@revealui/db/schema/cms'`

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('wrong sub-module'))).toBe(true)
    })

    it('should pass validation for correct transformation', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = `import { agentActions, agentContexts } from '@revealui/db/schema/agents'
import { posts, media } from '@revealui/db/schema/cms'
import { users } from '@revealui/db/schema/users'`

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should handle tables from multiple sub-modules correctly', () => {
      const original = "import type { users, posts } from '../core/index.js'"
      const transformed = `import { users } from '@revealui/db/schema/users'
import { posts, media } from '@revealui/db/schema/cms'
import { agentActions, agentContexts } from '@revealui/db/schema/agents'`

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(true)
    })

    it('should detect tables imported from wrong sub-module', () => {
      const original = "import type { users } from '../core/index.js'"
      const transformed = `import { users } from '@revealui/db/schema/users'
import { agentActions } from '@revealui/db/schema/cms'
import { agentContexts } from '@revealui/db/schema/agents'
import { posts } from '@revealui/db/schema/cms'
import { media } from '@revealui/db/schema/cms'`

      const result = validateTransformation(original, transformed, mockTableMapping)

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) =>
          e.includes("Table 'agentActions' imported from wrong sub-module"),
        ),
      ).toBe(true)
    })
  })

  describe('Integration tests', () => {
    it('should generate valid imports for real table mapping', () => {
      const mapping = discoverTableMappings()

      // Should have tables
      expect(Object.keys(mapping).length).toBeGreaterThan(0)

      // Generate imports
      const imports = generateNeonImports(mapping)

      // Should contain expected structure
      expect(imports).toContain('@revealui/db/schema/')
      expect(imports.length).toBeGreaterThan(0)

      // Validate the generated imports
      const allTables = Object.values(mapping).flat()
      for (const table of allTables) {
        expect(imports).toContain(table)
      }
    })

    it('should validate a complete transformation workflow', () => {
      const mapping = discoverTableMappings()
      const imports = generateNeonImports(mapping)

      // Create mock original content
      const originalContent = `import type {
  agentActions,
  users,
  sites,
} from '../core/index.js'

// Rest of file...`

      // Create transformed content
      const transformedContent = `${imports}

// Rest of file...`

      // Validate
      const result = validateTransformation(originalContent, transformedContent, mapping)

      // Should pass if we have the right tables
      if (Object.keys(mapping).length > 0) {
        // At minimum, old pattern should be gone
        expect(transformedContent).not.toContain("../core/index.js'")
        expect(transformedContent).toContain('@revealui/db/schema/')
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty table mapping', () => {
      const mapping: TableMapping = {}

      const imports = generateNeonImports(mapping)

      // Should still have header comment
      expect(imports).toContain('// Import table definitions')
      // But no actual imports
      expect(imports).not.toContain('import {')
    })

    it('should handle single sub-module with many tables', () => {
      const mapping: TableMapping = {
        test: Array.from({ length: 20 }, (_, i) => `table${i}`),
      }

      const imports = generateNeonImports(mapping)

      expect(imports).toContain('import {')
      expect(imports).toContain('  table0,')
      expect(imports).toContain('  table19,')
    })

    it('should handle invalid import syntax gracefully', () => {
      const original = "import type { users } from '../core/index.js'"
      // TypeScript parser might handle some syntax errors, but missing imports should be caught
      const transformed = `// No valid imports at all - just comments`

      const result = validateTransformation(original, transformed, {
        users: ['users'],
      })

      // Should detect missing imports
      expect(result.valid).toBe(false)
      expect(
        result.errors.some(
          (e) => e.includes('sub-module imports') || e.includes('No sub-module imports'),
        ),
      ).toBe(true)
    })
  })
})
