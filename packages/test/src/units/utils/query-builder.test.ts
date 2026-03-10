/**
 * Unit tests for query builder utilities
 *
 * Tests actual utilities from packages/core/src/queries/queryBuilder.ts
 */

import { describe, expect, it } from 'vitest'
// @ts-expect-error - Direct import for testing
import {
  buildWhereClause,
  extractWhereValues,
} from '../../../../../packages/core/src/queries/queryBuilder.js'
import type { RevealWhere } from '../../../../../packages/core/src/types/index.js'

describe('Query Builder Utilities', () => {
  describe('buildWhereClause', () => {
    it('should return empty string for undefined where', () => {
      const params: unknown[] = []
      const clause = buildWhereClause(undefined, params)

      expect(clause).toBe('')
      expect(params).toHaveLength(0)
    })

    it('should build simple equals condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '123',
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" = $1')
      expect(params).toEqual(['123'])
    })

    it('should build equals condition with operator', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: {
          equals: '123',
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" = $1')
      expect(params).toEqual(['123'])
    })

    it('should build not_equals condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: {
          not_equals: '123',
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" != $1')
      expect(params).toEqual(['123'])
    })

    it('should build IN condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: {
          in: ['1', '2', '3'],
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" IN ($1, $2, $3)')
      expect(params).toEqual(['1', '2', '3'])
    })

    it('should handle empty IN array', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: {
          in: [],
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('1=0') // Always false
      expect(params).toHaveLength(0)
    })

    it('should build NOT IN condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: {
          not_in: ['1', '2'],
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" NOT IN ($1, $2)')
      expect(params).toEqual(['1', '2'])
    })

    it('should build contains condition (LIKE)', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        title: {
          contains: 'test',
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe(`"title" LIKE $1 ESCAPE '\\'`)
      expect(params).toEqual(['%test%'])
    })

    it('should build greater_than condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        price: {
          greater_than: 100,
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"price" > $1')
      expect(params).toEqual([100])
    })

    it('should build less_than condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        price: {
          less_than: 100,
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"price" < $1')
      expect(params).toEqual([100])
    })

    it('should build exists condition (IS NOT NULL)', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        description: {
          exists: true,
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"description" IS NOT NULL')
      expect(params).toHaveLength(0)
    })

    it('should build exists condition (IS NULL)', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        description: {
          exists: false,
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"description" IS NULL')
      expect(params).toHaveLength(0)
    })

    it('should build AND condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        and: [{ id: '1' }, { title: 'Test' }],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" = $1 AND "title" = $2')
      expect(params).toEqual(['1', 'Test'])
    })

    it('should build OR condition', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        or: [{ id: '1' }, { id: '2' }],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('("id" = $1 OR "id" = $2)')
      expect(params).toEqual(['1', '2'])
    })

    it('should combine multiple conditions with AND', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '1',
        title: 'Test',
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" = $1 AND "title" = $2')
      expect(params).toEqual(['1', 'Test'])
    })

    it('should include WHERE keyword when requested', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '1',
      }

      const clause = buildWhereClause(where, params, {
        includeWhereKeyword: true,
      })

      expect(clause).toBe('WHERE "id" = $1')
    })

    it('should use positional parameter style', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '1',
      }

      const clause = buildWhereClause(where, params, {
        parameterStyle: 'positional',
      })

      expect(clause).toBe('"id" = ?')
      expect(params).toEqual(['1'])
    })

    it('should not quote fields when quoteFields is false', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '1',
      }

      const clause = buildWhereClause(where, params, {
        quoteFields: false,
      })

      expect(clause).toBe('id = $1')
    })

    it('should handle nested AND conditions', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        and: [
          { id: '1' },
          {
            and: [{ title: 'Test' }, { published: true }],
          },
        ],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toContain('"id" = $1')
      expect(clause).toContain('"title" = $2')
      expect(clause).toContain('"published" = $3')
      expect(params).toHaveLength(3)
    })

    it('should handle nested OR conditions', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        or: [
          { id: '1' },
          {
            or: [{ id: '2' }, { id: '3' }],
          },
        ],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toContain('$1')
      expect(clause).toContain('$2')
      expect(clause).toContain('$3')
      expect(params).toEqual(['1', '2', '3'])
    })

    it('should handle Date values', () => {
      const params: unknown[] = []
      const date = new Date('2024-01-01')
      const where: RevealWhere = {
        createdAt: date,
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"createdAt" = $1')
      expect(params).toEqual([date])
    })

    it('should handle array values as equals', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        tags: ['tag1', 'tag2'] as unknown,
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"tags" = $1')
      expect(params).toEqual([['tag1', 'tag2']])
    })

    it('should handle like operator', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        title: {
          like: 'test%',
        },
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"title" LIKE $1')
      expect(params).toEqual(['test%'])
    })

    it('should skip null and undefined values', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '1',
        title: null as unknown,
        description: undefined as unknown,
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('"id" = $1')
      expect(params).toEqual(['1'])
    })

    it('should return empty string for empty AND array', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        and: [],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('')
    })

    it('should return empty string for empty OR array', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        or: [],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('')
    })

    it('should never return WHERE prefix when includeWhereKeyword is false', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: '1',
      }

      const clause = buildWhereClause(where, params, {
        includeWhereKeyword: false,
      })

      expect(clause).not.toMatch(/^WHERE /i)
      expect(clause).toBe('"id" = $1')
    })

    it('should handle nested OR with multiple conditions', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        or: [{ id: '1' }, { id: '2' }, { id: '3' }],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('("id" = $1 OR "id" = $2 OR "id" = $3)')
      expect(params).toEqual(['1', '2', '3'])
      expect(clause).not.toMatch(/^WHERE /i)
    })

    it('should handle complex nested AND/OR conditions', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        and: [
          { id: '1' },
          {
            or: [{ title: 'Test' }, { title: 'Other' }],
          },
        ],
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toContain('"id" = $1')
      expect(clause).toContain('"title" = $2')
      expect(clause).toContain('"title" = $3')
      expect(params).toHaveLength(3)
      expect(clause).not.toMatch(/^WHERE /i)
    })

    it('should handle empty WHERE object gracefully', () => {
      const params: unknown[] = []
      const where: RevealWhere = {}

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('')
      expect(params).toHaveLength(0)
    })

    it('should handle WHERE with all null/undefined conditions', () => {
      const params: unknown[] = []
      const where: RevealWhere = {
        id: null as unknown,
        title: undefined as unknown,
        description: null as unknown,
      }

      const clause = buildWhereClause(where, params)

      expect(clause).toBe('')
      expect(params).toHaveLength(0)
    })
  })

  describe('extractWhereValues', () => {
    it('should extract values from simple where', () => {
      const where: RevealWhere = {
        id: '1',
        title: 'Test',
      }

      const values = extractWhereValues(where)

      expect(values).toEqual(['1', 'Test'])
    })

    it('should extract values from operators', () => {
      const where: RevealWhere = {
        id: {
          equals: '1',
          not_equals: '2',
        },
      }

      const values = extractWhereValues(where)

      expect(values).toEqual(['1', '2'])
    })

    it('should extract values from IN operator', () => {
      const where: RevealWhere = {
        id: {
          in: ['1', '2', '3'],
        },
      }

      const values = extractWhereValues(where)

      expect(values).toEqual(['1', '2', '3'])
    })

    it('should extract values from contains operator', () => {
      const where: RevealWhere = {
        title: {
          contains: 'test',
        },
      }

      const values = extractWhereValues(where)

      expect(values).toEqual(['%test%'])
    })

    it('should extract values from nested AND conditions', () => {
      const where: RevealWhere = {
        and: [{ id: '1' }, { title: 'Test' }],
      }

      const values = extractWhereValues(where)

      expect(values).toEqual(['1', 'Test'])
    })

    it('should extract values from nested OR conditions', () => {
      const where: RevealWhere = {
        or: [{ id: '1' }, { id: '2' }],
      }

      const values = extractWhereValues(where)

      expect(values).toEqual(['1', '2'])
    })

    it('should return empty array for undefined where', () => {
      const values = extractWhereValues(undefined)

      expect(values).toEqual([])
    })

    it('should skip exists operator (no value)', () => {
      const where: RevealWhere = {
        description: {
          exists: true,
        },
      }

      const values = extractWhereValues(where)

      expect(values).toEqual([])
    })
  })
})
