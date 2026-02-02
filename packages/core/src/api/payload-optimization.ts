/**
 * API Payload Optimization
 *
 * Reduces payload size through field selection, pagination, and data transformation
 */

interface PaginationOptions {
  page?: number
  limit?: number
  cursor?: string
  defaultLimit?: number
  maxLimit?: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page?: number
    limit: number
    total?: number
    hasMore: boolean
    nextCursor?: string | null
    prevCursor?: string | null
  }
}

interface FieldSelectionOptions {
  include?: string[]
  exclude?: string[]
  defaultFields?: string[]
}

/**
 * Paginate array of items
 */
export function paginateArray<T>(
  items: T[],
  options: PaginationOptions = {},
): PaginatedResponse<T> {
  const {
    page = 1,
    limit = options.defaultLimit || 20,
    maxLimit = 100,
  } = options

  // Enforce max limit
  const effectiveLimit = Math.min(limit, maxLimit)

  // Calculate offset
  const offset = (page - 1) * effectiveLimit

  // Slice data
  const data = items.slice(offset, offset + effectiveLimit)

  return {
    data,
    pagination: {
      page,
      limit: effectiveLimit,
      total: items.length,
      hasMore: offset + effectiveLimit < items.length,
    },
  }
}

/**
 * Create cursor for cursor-based pagination
 */
export function createCursor(item: Record<string, unknown>, field: string = 'id'): string {
  const value = item[field]
  return Buffer.from(JSON.stringify({ field, value })).toString('base64')
}

/**
 * Parse cursor
 */
export function parseCursor(cursor: string): { field: string; value: unknown } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Select fields from object
 */
export function selectFields<T extends Record<string, unknown>>(
  obj: T,
  options: FieldSelectionOptions,
): Partial<T> {
  const { include, exclude, defaultFields } = options

  // If include is specified, only include those fields
  if (include && include.length > 0) {
    const result: Partial<T> = {}
    for (const field of include) {
      if (field in obj) {
        result[field as keyof T] = obj[field]
      }
    }
    return result
  }

  // If exclude is specified, exclude those fields
  if (exclude && exclude.length > 0) {
    const result: Partial<T> = { ...obj }
    for (const field of exclude) {
      delete result[field as keyof T]
    }
    return result
  }

  // Use default fields
  if (defaultFields && defaultFields.length > 0) {
    const result: Partial<T> = {}
    for (const field of defaultFields) {
      if (field in obj) {
        result[field as keyof T] = obj[field]
      }
    }
    return result
  }

  // Return all fields
  return obj
}

/**
 * Select fields from array of objects
 */
export function selectFieldsFromArray<T extends Record<string, unknown>>(
  items: T[],
  options: FieldSelectionOptions,
): Partial<T>[] {
  return items.map((item) => selectFields(item, options))
}

/**
 * Remove null and undefined values
 */
export function removeEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key as keyof T] = value
    }
  }

  return result
}

/**
 * Flatten nested object
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else {
      result[newKey] = value
    }
  }

  return result
}

/**
 * Minimize JSON response size
 */
export function minimizeJSON(data: unknown): string {
  return JSON.stringify(data, null, 0)
}

/**
 * Format JSON response (for development)
 */
export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Remove sensitive fields
 */
export function sanitizeResponse<T extends Record<string, unknown>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'secret', 'token', 'apiKey'],
): Partial<T> {
  return selectFields(obj, { exclude: sensitiveFields })
}

/**
 * Transform timestamps to ISO strings
 */
export function transformDates<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      result[key] = value.toISOString()
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = transformDates(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? transformDates(item) : item,
      )
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Calculate payload size in bytes
 */
export function getPayloadSize(data: unknown): number {
  const json = JSON.stringify(data)
  return new Blob([json]).size
}

/**
 * Get payload size in human-readable format
 */
export function formatPayloadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Optimize payload by removing unnecessary data
 */
export interface OptimizationResult<T> {
  data: T
  originalSize: number
  optimizedSize: number
  savings: number
  savingsPercent: number
}

export function optimizePayload<T>(
  data: T,
  options: FieldSelectionOptions & {
    removeEmpty?: boolean
    transformDates?: boolean
    sanitize?: boolean
  } = {},
): OptimizationResult<T> {
  const originalSize = getPayloadSize(data)

  let optimized: unknown = data

  // Select fields
  if (Array.isArray(data)) {
    optimized = selectFieldsFromArray(data as Array<Record<string, unknown>>, options)
  } else if (typeof data === 'object' && data !== null) {
    optimized = selectFields(data as Record<string, unknown>, options)
  }

  // Remove empty values
  if (options.removeEmpty) {
    if (Array.isArray(optimized)) {
      optimized = optimized.map((item) => removeEmpty(item))
    } else if (typeof optimized === 'object') {
      optimized = removeEmpty(optimized)
    }
  }

  // Transform dates
  if (options.transformDates) {
    if (Array.isArray(optimized)) {
      optimized = optimized.map((item) => transformDates(item))
    } else if (typeof optimized === 'object') {
      optimized = transformDates(optimized)
    }
  }

  // Sanitize
  if (options.sanitize) {
    if (Array.isArray(optimized)) {
      optimized = optimized.map((item) => sanitizeResponse(item))
    } else if (typeof optimized === 'object') {
      optimized = sanitizeResponse(optimized)
    }
  }

  const optimizedSize = getPayloadSize(optimized)
  const savings = originalSize - optimizedSize
  const savingsPercent = (savings / originalSize) * 100

  return {
    data: optimized,
    originalSize,
    optimizedSize,
    savings,
    savingsPercent,
  }
}

/**
 * Create API response with optimized payload
 */
export function createOptimizedResponse<T>(
  data: T,
  options: {
    pagination?: PaginationOptions
    fields?: FieldSelectionOptions
    optimize?: boolean
    compress?: boolean
  } = {},
): {
  data: unknown
  meta?: {
    pagination?: PaginatedResponse<T>['pagination']
    size?: {
      original: string
      optimized: string
      savings: string
    }
  }
} {
  let result: unknown = data

  // Paginate if array
  if (Array.isArray(data) && options.pagination) {
    const paginated = paginateArray(data, options.pagination)
    result = {
      data: paginated.data,
      meta: {
        pagination: paginated.pagination,
      },
    }
  }

  // Optimize payload
  if (options.optimize) {
    const optimized = optimizePayload(result, options.fields || {})

    return {
      data: optimized.data,
      meta: {
        ...result.meta,
        size: {
          original: formatPayloadSize(optimized.originalSize),
          optimized: formatPayloadSize(optimized.optimizedSize),
          savings: `${optimized.savingsPercent.toFixed(1)}%`,
        },
      },
    }
  }

  return { data: result }
}

/**
 * Parse field selection from query params
 */
export function parseFieldsFromQuery(query: string): FieldSelectionOptions {
  const params = new URLSearchParams(query)

  const include = params.get('fields')?.split(',').filter(Boolean)
  const exclude = params.get('exclude')?.split(',').filter(Boolean)

  return {
    include,
    exclude,
  }
}

/**
 * Parse pagination from query params
 */
export function parsePaginationFromQuery(query: string): PaginationOptions {
  const params = new URLSearchParams(query)

  const page = parseInt(params.get('page') || '1')
  const limit = parseInt(params.get('limit') || '20')
  const cursor = params.get('cursor') || undefined

  return {
    page,
    limit,
    cursor,
  }
}

/**
 * Batch responses to reduce round trips
 */
export function batchResponses<T>(
  responses: Array<{ key: string; data: T }>,
): Record<string, T> {
  const result: Record<string, T> = {}

  for (const { key, data } of responses) {
    result[key] = data
  }

  return result
}

/**
 * Create partial response (for large objects)
 */
export function createPartialResponse<T extends Record<string, unknown>>(
  obj: T,
  maxDepth: number = 2,
  currentDepth: number = 0,
): Partial<T> | string {
  if (currentDepth >= maxDepth) {
    return '[truncated]'
  }

  const result: Partial<T> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      result[key] = value.slice(0, 10).map((item) =>
        typeof item === 'object' && item !== null
          ? createPartialResponse(item, maxDepth, currentDepth + 1)
          : item,
      )
      if (value.length > 10) {
        result[`${key}_count`] = value.length
      }
    } else if (value !== null && typeof value === 'object') {
      result[key] = createPartialResponse(value, maxDepth, currentDepth + 1)
    } else {
      result[key] = value
    }
  }

  return result
}
