import { describe, expect, it } from 'vitest'

import {
  batchResponses,
  createCursor,
  createOptimizedResponse,
  createPartialResponse,
  flattenObject,
  formatJSON,
  formatPayloadSize,
  getPayloadSize,
  minimizeJSON,
  optimizePayload,
  paginateArray,
  parseCursor,
  parseFieldsFromQuery,
  parsePaginationFromQuery,
  removeEmpty,
  sanitizeResponse,
  selectFields,
  selectFieldsFromArray,
  transformDates,
} from '../payload-optimization.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItems(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `item-${i + 1}`,
    value: i * 10,
  }))
}

// ---------------------------------------------------------------------------
// paginateArray
// ---------------------------------------------------------------------------
describe('paginateArray', () => {
  const items = makeItems(50)

  it('returns first page with default options', () => {
    const result = paginateArray(items)
    expect(result.data).toHaveLength(20)
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(20)
    expect(result.pagination.total).toBe(50)
    expect(result.pagination.hasMore).toBe(true)
  })

  it('returns correct page and limit', () => {
    const result = paginateArray(items, { page: 2, limit: 10 })
    expect(result.data).toHaveLength(10)
    expect(result.data[0]).toEqual({ id: 11, name: 'item-11', value: 100 })
    expect(result.pagination.page).toBe(2)
    expect(result.pagination.limit).toBe(10)
    expect(result.pagination.hasMore).toBe(true)
  })

  it('returns last page with hasMore false', () => {
    const result = paginateArray(items, { page: 5, limit: 10 })
    expect(result.data).toHaveLength(10)
    expect(result.pagination.hasMore).toBe(false)
  })

  it('returns empty data for out-of-bounds page', () => {
    const result = paginateArray(items, { page: 100, limit: 10 })
    expect(result.data).toHaveLength(0)
    expect(result.pagination.hasMore).toBe(false)
  })

  it('handles empty array', () => {
    const result = paginateArray([])
    expect(result.data).toHaveLength(0)
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.hasMore).toBe(false)
  })

  it('enforces maxLimit', () => {
    const result = paginateArray(items, { limit: 200, maxLimit: 25 })
    expect(result.pagination.limit).toBe(25)
    expect(result.data).toHaveLength(25)
  })

  it('uses defaultLimit when limit is not provided', () => {
    const result = paginateArray(items, { defaultLimit: 5 })
    expect(result.pagination.limit).toBe(5)
    expect(result.data).toHaveLength(5)
  })

  it('handles page 1 with limit larger than array', () => {
    const small = makeItems(3)
    const result = paginateArray(small, { limit: 10 })
    expect(result.data).toHaveLength(3)
    expect(result.pagination.hasMore).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createCursor / parseCursor
// ---------------------------------------------------------------------------
describe('createCursor / parseCursor', () => {
  it('round-trips with default field (id)', () => {
    const item = { id: 'abc-123', name: 'test' }
    const cursor = createCursor(item)
    const parsed = parseCursor(cursor)
    expect(parsed).toEqual({ field: 'id', value: 'abc-123' })
  })

  it('round-trips with custom field', () => {
    const item = { id: 1, createdAt: '2024-01-01' }
    const cursor = createCursor(item, 'createdAt')
    const parsed = parseCursor(cursor)
    expect(parsed).toEqual({ field: 'createdAt', value: '2024-01-01' })
  })

  it('handles numeric values', () => {
    const item = { id: 42 }
    const cursor = createCursor(item)
    const parsed = parseCursor(cursor)
    expect(parsed).toEqual({ field: 'id', value: 42 })
  })

  it('handles missing field gracefully', () => {
    const item = { name: 'no-id' }
    const cursor = createCursor(item, 'id')
    const parsed = parseCursor(cursor)
    expect(parsed).toEqual({ field: 'id', value: undefined })
  })

  it('returns null for invalid base64', () => {
    expect(parseCursor('not-valid-json!!!')).toBeNull()
  })

  it('returns null for non-JSON base64', () => {
    const bad = Buffer.from('this is not json').toString('base64')
    expect(parseCursor(bad)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCursor('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// selectFields
// ---------------------------------------------------------------------------
describe('selectFields', () => {
  const obj = { id: 1, name: 'test', email: 'a@b.com', password: 'secret' }

  it('includes only specified fields', () => {
    const result = selectFields(obj, { include: ['id', 'name'] })
    expect(result).toEqual({ id: 1, name: 'test' })
  })

  it('excludes specified fields', () => {
    const result = selectFields(obj, { exclude: ['password'] })
    expect(result).toEqual({ id: 1, name: 'test', email: 'a@b.com' })
  })

  it('uses defaultFields when no include/exclude', () => {
    const result = selectFields(obj, { defaultFields: ['id'] })
    expect(result).toEqual({ id: 1 })
  })

  it('returns all fields when no options specified', () => {
    const result = selectFields(obj, {})
    expect(result).toBe(obj)
  })

  it('ignores non-existent include fields', () => {
    const result = selectFields(obj, { include: ['id', 'nonExistent'] })
    expect(result).toEqual({ id: 1 })
  })

  it('include takes priority over exclude', () => {
    const result = selectFields(obj, {
      include: ['id', 'name'],
      exclude: ['id'],
    })
    // include is checked first
    expect(result).toEqual({ id: 1, name: 'test' })
  })

  it('handles empty include array (falls through to exclude)', () => {
    const result = selectFields(obj, { include: [], exclude: ['password'] })
    expect(result).toEqual({ id: 1, name: 'test', email: 'a@b.com' })
  })

  it('handles empty exclude array (falls through to defaultFields)', () => {
    const result = selectFields(obj, { exclude: [], defaultFields: ['id'] })
    expect(result).toEqual({ id: 1 })
  })
})

// ---------------------------------------------------------------------------
// selectFieldsFromArray
// ---------------------------------------------------------------------------
describe('selectFieldsFromArray', () => {
  const items = [
    { id: 1, name: 'a', secret: 'x' },
    { id: 2, name: 'b', secret: 'y' },
  ]

  it('applies field selection to every item', () => {
    const result = selectFieldsFromArray(items, { include: ['id', 'name'] })
    expect(result).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
  })

  it('handles empty array', () => {
    const result = selectFieldsFromArray([], { include: ['id'] })
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// removeEmpty
// ---------------------------------------------------------------------------
describe('removeEmpty', () => {
  it('removes null values', () => {
    const result = removeEmpty({ a: 1, b: null } as Record<string, unknown>)
    expect(result).toEqual({ a: 1 })
  })

  it('removes undefined values', () => {
    const result = removeEmpty({ a: 1, b: undefined })
    expect(result).toEqual({ a: 1 })
  })

  it('keeps empty strings (only removes null/undefined)', () => {
    const result = removeEmpty({ a: '', b: 0, c: false })
    expect(result).toEqual({ a: '', b: 0, c: false })
  })

  it('keeps zero and false values', () => {
    const result = removeEmpty({ zero: 0, bool: false, empty: '' })
    expect(result).toEqual({ zero: 0, bool: false, empty: '' })
  })

  it('returns empty object when all values are null/undefined', () => {
    const result = removeEmpty({ a: null, b: undefined } as Record<string, unknown>)
    expect(result).toEqual({})
  })

  it('handles object with no empty values', () => {
    const obj = { a: 1, b: 'hello' }
    const result = removeEmpty(obj)
    expect(result).toEqual(obj)
  })
})

// ---------------------------------------------------------------------------
// flattenObject
// ---------------------------------------------------------------------------
describe('flattenObject', () => {
  it('flattens nested objects with dot notation', () => {
    const result = flattenObject({ a: { b: { c: 1 } } })
    expect(result).toEqual({ 'a.b.c': 1 })
  })

  it('keeps arrays as values (does not flatten them)', () => {
    const result = flattenObject({ a: [1, 2, 3] })
    expect(result).toEqual({ a: [1, 2, 3] })
  })

  it('handles flat objects unchanged', () => {
    const result = flattenObject({ a: 1, b: 'two' })
    expect(result).toEqual({ a: 1, b: 'two' })
  })

  it('handles empty object', () => {
    expect(flattenObject({})).toEqual({})
  })

  it('handles null values', () => {
    const result = flattenObject({ a: null, b: 1 } as Record<string, unknown>)
    expect(result).toEqual({ a: null, b: 1 })
  })

  it('handles mix of nested and flat keys', () => {
    const result = flattenObject({
      id: 1,
      meta: { created: '2024-01-01', author: { name: 'test' } },
    })
    expect(result).toEqual({
      id: 1,
      'meta.created': '2024-01-01',
      'meta.author.name': 'test',
    })
  })

  it('respects custom prefix', () => {
    const result = flattenObject({ a: 1 }, 'root')
    expect(result).toEqual({ 'root.a': 1 })
  })
})

// ---------------------------------------------------------------------------
// minimizeJSON / formatJSON
// ---------------------------------------------------------------------------
describe('minimizeJSON', () => {
  it('produces compact JSON', () => {
    const data = { a: 1, b: [2, 3] }
    const result = minimizeJSON(data)
    expect(result).toBe('{"a":1,"b":[2,3]}')
    expect(result).not.toContain('\n')
  })

  it('handles null', () => {
    expect(minimizeJSON(null)).toBe('null')
  })

  it('handles primitive values', () => {
    expect(minimizeJSON(42)).toBe('42')
    expect(minimizeJSON('hello')).toBe('"hello"')
  })
})

describe('formatJSON', () => {
  it('produces pretty-printed JSON', () => {
    const data = { a: 1 }
    const result = formatJSON(data)
    expect(result).toContain('\n')
    expect(result).toBe('{\n  "a": 1\n}')
  })
})

// ---------------------------------------------------------------------------
// sanitizeResponse
// ---------------------------------------------------------------------------
describe('sanitizeResponse', () => {
  it('removes default sensitive fields', () => {
    const obj = {
      id: 1,
      name: 'user',
      password: 'hash',
      secret: 'abc',
      token: 'tok',
      apiKey: 'key',
      email: 'a@b.com',
    }
    const result = sanitizeResponse(obj)
    expect(result).toEqual({ id: 1, name: 'user', email: 'a@b.com' })
    expect(result).not.toHaveProperty('password')
    expect(result).not.toHaveProperty('secret')
    expect(result).not.toHaveProperty('token')
    expect(result).not.toHaveProperty('apiKey')
  })

  it('removes custom sensitive fields', () => {
    const obj = { id: 1, ssn: '123-45-6789', name: 'test' }
    const result = sanitizeResponse(obj, ['ssn'])
    expect(result).toEqual({ id: 1, name: 'test' })
  })

  it('returns all fields when no sensitive fields match', () => {
    const obj = { id: 1, name: 'test' }
    const result = sanitizeResponse(obj)
    expect(result).toEqual({ id: 1, name: 'test' })
  })
})

// ---------------------------------------------------------------------------
// transformDates
// ---------------------------------------------------------------------------
describe('transformDates', () => {
  it('converts Date objects to ISO strings', () => {
    const date = new Date('2024-06-15T12:00:00Z')
    const result = transformDates({ createdAt: date, name: 'test' })
    expect(result.createdAt).toBe('2024-06-15T12:00:00.000Z')
    expect(result.name).toBe('test')
  })

  it('recursively transforms nested dates', () => {
    const date = new Date('2024-01-01T00:00:00Z')
    const result = transformDates({
      meta: { updatedAt: date },
    })
    expect((result.meta as Record<string, unknown>).updatedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('transforms dates inside arrays', () => {
    const date = new Date('2024-03-01T00:00:00Z')
    const result = transformDates({
      items: [{ created: date }, { created: date }],
    })
    const items = result.items as Array<Record<string, unknown>>
    expect(items[0].created).toBe('2024-03-01T00:00:00.000Z')
    expect(items[1].created).toBe('2024-03-01T00:00:00.000Z')
  })

  it('preserves non-date values in arrays', () => {
    const result = transformDates({ tags: ['a', 'b', 'c'] })
    expect(result.tags).toEqual(['a', 'b', 'c'])
  })

  it('handles object with no dates', () => {
    const obj = { id: 1, name: 'test' }
    const result = transformDates(obj)
    expect(result).toEqual(obj)
  })

  it('handles null values gracefully', () => {
    const result = transformDates({ a: null } as Record<string, unknown>)
    expect(result.a).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getPayloadSize / formatPayloadSize
// ---------------------------------------------------------------------------
describe('getPayloadSize', () => {
  it('returns size in bytes', () => {
    const size = getPayloadSize({ a: 1 })
    // '{"a":1}' = 7 bytes
    expect(size).toBe(7)
  })

  it('handles empty object', () => {
    expect(getPayloadSize({})).toBe(2) // '{}'
  })

  it('handles null', () => {
    expect(getPayloadSize(null)).toBe(4) // 'null'
  })
})

describe('formatPayloadSize', () => {
  it('formats bytes', () => {
    expect(formatPayloadSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatPayloadSize(2048)).toBe('2.00 KB')
  })

  it('formats megabytes', () => {
    expect(formatPayloadSize(2 * 1024 * 1024)).toBe('2.00 MB')
  })

  it('formats fractional KB', () => {
    expect(formatPayloadSize(1536)).toBe('1.50 KB')
  })

  it('handles zero', () => {
    expect(formatPayloadSize(0)).toBe('0 B')
  })

  it('handles boundary at 1024', () => {
    expect(formatPayloadSize(1024)).toBe('1.00 KB')
  })

  it('handles boundary at 1MB', () => {
    expect(formatPayloadSize(1024 * 1024)).toBe('1.00 MB')
  })
})

// ---------------------------------------------------------------------------
// optimizePayload
// ---------------------------------------------------------------------------
describe('optimizePayload', () => {
  it('returns optimization metrics', () => {
    const data = { id: 1, name: 'test', password: 'secret', extra: null }
    const result = optimizePayload(data, {
      exclude: ['password'],
      removeEmpty: true,
    })
    expect(result.originalSize).toBeGreaterThan(0)
    expect(result.optimizedSize).toBeLessThanOrEqual(result.originalSize)
    expect(result.savings).toBeGreaterThanOrEqual(0)
    expect(result.savingsPercent).toBeGreaterThanOrEqual(0)
  })

  it('applies field exclusion', () => {
    const result = optimizePayload(
      { id: 1, name: 'test', password: 'secret' },
      { exclude: ['password'] },
    )
    expect(result.data).toEqual({ id: 1, name: 'test' })
  })

  it('applies removeEmpty', () => {
    const result = optimizePayload({ id: 1, name: null } as Record<string, unknown>, {
      removeEmpty: true,
    })
    expect(result.data).toEqual({ id: 1 })
  })

  it('applies transformDates', () => {
    const date = new Date('2024-01-01T00:00:00Z')
    const result = optimizePayload({ created: date }, { transformDates: true })
    expect((result.data as Record<string, unknown>).created).toBe('2024-01-01T00:00:00.000Z')
  })

  it('applies sanitize', () => {
    const result = optimizePayload({ id: 1, password: 'hash', token: 'tok' }, { sanitize: true })
    expect(result.data).toEqual({ id: 1 })
  })

  it('handles array data with field selection', () => {
    const data = [
      { id: 1, name: 'a', secret: 'x' },
      { id: 2, name: 'b', secret: 'y' },
    ]
    const result = optimizePayload(data, { include: ['id', 'name'] })
    expect(result.data).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
  })

  it('handles array data with removeEmpty', () => {
    const data = [
      { id: 1, val: null },
      { id: 2, val: 'ok' },
    ] as Array<Record<string, unknown>>
    const result = optimizePayload(data, { removeEmpty: true })
    expect(result.data).toEqual([{ id: 1 }, { id: 2, val: 'ok' }])
  })

  it('handles array data with transformDates', () => {
    const date = new Date('2024-06-01T00:00:00Z')
    const data = [{ id: 1, at: date }]
    const result = optimizePayload(data, { transformDates: true })
    const items = result.data as Array<Record<string, unknown>>
    expect(items[0].at).toBe('2024-06-01T00:00:00.000Z')
  })

  it('handles array data with sanitize', () => {
    const data = [
      { id: 1, password: 'p1' },
      { id: 2, password: 'p2' },
    ]
    const result = optimizePayload(data, { sanitize: true })
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('returns unchanged data with no options', () => {
    const data = { id: 1, name: 'test' }
    const result = optimizePayload(data)
    expect(result.data).toEqual(data)
    expect(result.savings).toBe(0)
  })

  it('handles primitive data unchanged', () => {
    const result = optimizePayload('hello' as unknown)
    expect(result.data).toBe('hello')
  })

  it('handles null data', () => {
    const result = optimizePayload(null)
    expect(result.data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createOptimizedResponse
// ---------------------------------------------------------------------------
describe('createOptimizedResponse', () => {
  it('returns data without meta when no options given', () => {
    const result = createOptimizedResponse({ id: 1 })
    expect(result.data).toEqual({ id: 1 })
    expect(result.meta).toBeUndefined()
  })

  it('paginates array data', () => {
    const items = makeItems(30)
    const result = createOptimizedResponse(items, {
      pagination: { page: 1, limit: 10 },
    })
    const inner = result.data as { data: unknown[]; meta: { pagination: unknown } }
    expect(inner.data).toHaveLength(10)
    expect(inner.meta.pagination).toBeDefined()
  })

  it('adds size meta when optimize is true', () => {
    const data = { id: 1, password: 'secret', name: 'test' }
    const result = createOptimizedResponse(data, {
      optimize: true,
      fields: { exclude: ['password'] },
    })
    expect(result.meta).toBeDefined()
    expect(result.meta?.size).toBeDefined()
    expect(result.meta?.size?.original).toContain('B')
    expect(result.meta?.size?.savings).toContain('%')
  })

  it('combines pagination and optimization', () => {
    const items = makeItems(30)
    const result = createOptimizedResponse(items, {
      pagination: { page: 1, limit: 5 },
      optimize: true,
    })
    expect(result.meta).toBeDefined()
    expect(result.meta?.size).toBeDefined()
    // Pagination meta should be merged into meta
    expect(result.meta?.pagination).toBeDefined()
  })

  it('returns non-array data without pagination even if pagination options given', () => {
    const result = createOptimizedResponse(
      { id: 1 },
      {
        pagination: { page: 1, limit: 10 },
      },
    )
    // Non-array data is not paginated
    expect(result.data).toEqual({ id: 1 })
  })
})

// ---------------------------------------------------------------------------
// parseFieldsFromQuery
// ---------------------------------------------------------------------------
describe('parseFieldsFromQuery', () => {
  it('parses include fields', () => {
    const result = parseFieldsFromQuery('fields=id,name,email')
    expect(result.include).toEqual(['id', 'name', 'email'])
  })

  it('parses exclude fields', () => {
    const result = parseFieldsFromQuery('exclude=password,secret')
    expect(result.exclude).toEqual(['password', 'secret'])
  })

  it('parses both include and exclude', () => {
    const result = parseFieldsFromQuery('fields=id,name&exclude=password')
    expect(result.include).toEqual(['id', 'name'])
    expect(result.exclude).toEqual(['password'])
  })

  it('returns undefined when no fields params', () => {
    const result = parseFieldsFromQuery('page=1&limit=10')
    expect(result.include).toBeUndefined()
    expect(result.exclude).toBeUndefined()
  })

  it('filters empty strings from comma-separated values', () => {
    const result = parseFieldsFromQuery('fields=id,,name,')
    expect(result.include).toEqual(['id', 'name'])
  })
})

// ---------------------------------------------------------------------------
// parsePaginationFromQuery
// ---------------------------------------------------------------------------
describe('parsePaginationFromQuery', () => {
  it('parses page and limit', () => {
    const result = parsePaginationFromQuery('page=3&limit=25')
    expect(result.page).toBe(3)
    expect(result.limit).toBe(25)
  })

  it('defaults page to 1 and limit to 20', () => {
    const result = parsePaginationFromQuery('')
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('parses cursor', () => {
    const result = parsePaginationFromQuery('cursor=abc123')
    expect(result.cursor).toBe('abc123')
  })

  it('sets cursor to undefined when not present', () => {
    const result = parsePaginationFromQuery('page=1')
    expect(result.cursor).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// batchResponses
// ---------------------------------------------------------------------------
describe('batchResponses', () => {
  it('combines keyed responses into a single object', () => {
    const result = batchResponses([
      { key: 'users', data: [{ id: 1 }] },
      { key: 'posts', data: [{ id: 2 }] },
    ])
    expect(result).toEqual({
      users: [{ id: 1 }],
      posts: [{ id: 2 }],
    })
  })

  it('handles empty array', () => {
    expect(batchResponses([])).toEqual({})
  })

  it('last key wins on duplicates', () => {
    const result = batchResponses([
      { key: 'a', data: 1 },
      { key: 'a', data: 2 },
    ])
    expect(result).toEqual({ a: 2 })
  })
})

// ---------------------------------------------------------------------------
// createPartialResponse
// ---------------------------------------------------------------------------
describe('createPartialResponse', () => {
  it('returns full object within max depth', () => {
    const obj = { id: 1, name: 'test' }
    const result = createPartialResponse(obj)
    expect(result).toEqual({ id: 1, name: 'test' })
  })

  it('truncates beyond max depth', () => {
    const obj = { a: { b: { c: { d: 1 } } } }
    const result = createPartialResponse(obj, 2)
    expect((result as Record<string, unknown>).a).toEqual({
      b: '[truncated]',
    })
  })

  it('truncates at depth 0', () => {
    const obj = { a: 1 }
    const result = createPartialResponse(obj, 0)
    expect(result).toBe('[truncated]')
  })

  it('truncates arrays to first 10 items', () => {
    const bigArray = Array.from({ length: 25 }, (_, i) => i)
    const obj = { items: bigArray }
    const result = createPartialResponse(obj) as Record<string, unknown>
    expect(result.items).toHaveLength(10)
    expect(result.items_count).toBe(25)
  })

  it('does not add count key for arrays with 10 or fewer items', () => {
    const obj = { items: [1, 2, 3] }
    const result = createPartialResponse(obj) as Record<string, unknown>
    expect(result.items).toEqual([1, 2, 3])
    expect(result.items_count).toBeUndefined()
  })

  it('recursively truncates objects inside arrays', () => {
    const obj = {
      items: Array.from({ length: 5 }, (_, i) => ({
        id: i,
        deep: { nested: { value: i } },
      })),
    }
    // maxDepth=2, array items start at depth 1
    const result = createPartialResponse(obj, 2) as Record<string, unknown>
    const items = result.items as Array<Record<string, unknown>>
    expect(items[0].id).toBe(0)
    expect(items[0].deep).toBe('[truncated]')
  })

  it('handles deeply nested structures', () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            level4: 'deep',
          },
        },
      },
    }
    const result = createPartialResponse(obj, 3) as Record<string, unknown>
    const l1 = result.level1 as Record<string, unknown>
    const l2 = l1.level2 as Record<string, unknown>
    expect(l2.level3).toBe('[truncated]')
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('optimizePayload handles large payload', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      description: 'x'.repeat(100),
      password: 'secret',
    }))
    const result = optimizePayload(items, {
      include: ['id', 'name'],
      sanitize: true,
    })
    expect(result.optimizedSize).toBeLessThan(result.originalSize)
    expect(result.savingsPercent).toBeGreaterThan(0)
  })

  it('flattenObject with empty nested objects', () => {
    const result = flattenObject({ a: {} })
    expect(result).toEqual({})
  })

  it('transformDates with mixed array (objects and primitives)', () => {
    const date = new Date('2024-01-01T00:00:00Z')
    const result = transformDates({
      items: [42, 'text', { at: date }],
    })
    const items = result.items as unknown[]
    expect(items[0]).toBe(42)
    expect(items[1]).toBe('text')
    expect((items[2] as Record<string, unknown>).at).toBe('2024-01-01T00:00:00.000Z')
  })

  it('paginateArray with page=1, limit=0 (clamped by maxLimit)', () => {
    // limit=0 means no items per page
    const result = paginateArray(makeItems(10), { limit: 0 })
    expect(result.data).toHaveLength(0)
    expect(result.pagination.limit).toBe(0)
  })

  it('selectFields handles object with non-string keys gracefully', () => {
    const obj = { 1: 'a', 2: 'b', name: 'test' } as unknown as Record<string, unknown>
    const result = selectFields(obj, { include: ['name'] })
    expect(result).toEqual({ name: 'test' })
  })

  it('sanitizeResponse with empty sensitive fields list keeps all', () => {
    const obj = { id: 1, password: 'secret' }
    const result = sanitizeResponse(obj, [])
    expect(result).toEqual({ id: 1, password: 'secret' })
  })
})
