/**
 * Application-Level Caching
 *
 * Utilities for React Query, SWR, and application-level cache management
 */

/**
 * React Query Configuration
 */
export interface ReactQueryConfig {
  defaultOptions?: {
    queries?: {
      staleTime?: number
      cacheTime?: number
      refetchOnWindowFocus?: boolean
      refetchOnReconnect?: boolean
      refetchOnMount?: boolean
      retry?: number | boolean
      retryDelay?: number | ((attemptIndex: number) => number)
    }
    mutations?: {
      retry?: number | boolean
      retryDelay?: number | ((attemptIndex: number) => number)
    }
  }
}

export const DEFAULT_REACT_QUERY_CONFIG: ReactQueryConfig = {
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
}

/**
 * SWR Configuration
 */
export interface SWRConfig {
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  refreshInterval?: number
  dedupingInterval?: number
  loadingTimeout?: number
  errorRetryInterval?: number
  errorRetryCount?: number
  focusThrottleInterval?: number
  shouldRetryOnError?: boolean
  keepPreviousData?: boolean
}

export const DEFAULT_SWR_CONFIG: SWRConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 0,
  dedupingInterval: 2000,
  loadingTimeout: 3000,
  errorRetryInterval: 5000,
  errorRetryCount: 3,
  focusThrottleInterval: 5000,
  shouldRetryOnError: true,
  keepPreviousData: false,
}

/**
 * Cache Key Generator
 */
export class CacheKeyGenerator {
  private prefix: string

  constructor(prefix: string = 'app') {
    this.prefix = prefix
  }

  /**
   * Generate key for list queries
   */
  list(resource: string, filters?: Record<string, unknown>): string[] {
    const key = [this.prefix, resource, 'list']

    if (filters && Object.keys(filters).length > 0) {
      key.push(JSON.stringify(filters))
    }

    return key
  }

  /**
   * Generate key for detail queries
   */
  detail(resource: string, id: string | number): string[] {
    return [this.prefix, resource, 'detail', String(id)]
  }

  /**
   * Generate key for custom queries
   */
  custom(...parts: (string | number | Record<string, unknown>)[]): string[] {
    return [
      this.prefix,
      ...parts.map((part) =>
        typeof part === 'object' ? JSON.stringify(part) : String(part),
      ),
    ]
  }

  /**
   * Generate key for infinite queries
   */
  infinite(
    resource: string,
    filters?: Record<string, unknown>,
  ): string[] {
    const key = [this.prefix, resource, 'infinite']

    if (filters && Object.keys(filters).length > 0) {
      key.push(JSON.stringify(filters))
    }

    return key
  }
}

/**
 * Cache Invalidation Strategies
 */
export class CacheInvalidator {
  /**
   * Invalidate by resource
   */
  static byResource(resource: string): string[] {
    return ['app', resource]
  }

  /**
   * Invalidate by ID
   */
  static byId(resource: string, id: string | number): string[] {
    return ['app', resource, 'detail', String(id)]
  }

  /**
   * Invalidate lists
   */
  static lists(resource: string): string[] {
    return ['app', resource, 'list']
  }

  /**
   * Invalidate infinite queries
   */
  static infinite(resource: string): string[] {
    return ['app', resource, 'infinite']
  }

  /**
   * Invalidate all
   */
  static all(): string[] {
    return ['app']
  }
}

/**
 * Optimistic Update Helper
 */
export class OptimisticUpdater<T> {
  /**
   * Update list (add item)
   */
  static addToList<T>(
    oldData: T[] | undefined,
    newItem: T,
  ): T[] {
    if (!oldData) return [newItem]
    return [...oldData, newItem]
  }

  /**
   * Update list (remove item)
   */
  static removeFromList<T extends { id: string | number }>(
    oldData: T[] | undefined,
    id: string | number,
  ): T[] {
    if (!oldData) return []
    return oldData.filter((item) => item.id !== id)
  }

  /**
   * Update list (update item)
   */
  static updateInList<T extends { id: string | number }>(
    oldData: T[] | undefined,
    id: string | number,
    updates: Partial<T>,
  ): T[] {
    if (!oldData) return []
    return oldData.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    )
  }

  /**
   * Update detail
   */
  static updateDetail<T>(
    oldData: T | undefined,
    updates: Partial<T>,
  ): T | undefined {
    if (!oldData) return undefined
    return { ...oldData, ...updates }
  }

  /**
   * Update paginated list
   */
  static updatePaginatedList<T extends { id: string | number }>(
    oldData:
      | {
          pages: Array<{ data: T[] }>
          pageParams: unknown[]
        }
      | undefined,
    id: string | number,
    updates: Partial<T>,
  ) {
    if (!oldData) return undefined

    return {
      ...oldData,
      pages: oldData.pages.map((page) => ({
        ...page,
        data: page.data.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      })),
    }
  }
}

/**
 * Cache Prefetch Helper
 */
export interface PrefetchConfig {
  staleTime?: number
  cacheTime?: number
}

export class CachePrefetcher {
  /**
   * Prefetch on hover
   */
  static onHover(
    prefetchFn: () => Promise<unknown>,
    delay: number = 300,
  ): {
    onMouseEnter: () => void
    onMouseLeave: () => void
  } {
    let timeout: NodeJS.Timeout | null = null

    return {
      onMouseEnter: () => {
        timeout = setTimeout(() => {
          prefetchFn()
        }, delay)
      },
      onMouseLeave: () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
      },
    }
  }

  /**
   * Prefetch on visibility
   */
  static onVisible(
    element: HTMLElement | null,
    prefetchFn: () => Promise<unknown>,
    options?: IntersectionObserverInit,
  ): () => void {
    if (!element || typeof IntersectionObserver === 'undefined') {
      return () => {}
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          prefetchFn()
          observer.disconnect()
        }
      }
    }, options)

    observer.observe(element)

    return () => observer.disconnect()
  }

  /**
   * Prefetch on idle
   */
  static onIdle(prefetchFn: () => Promise<unknown>): void {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => prefetchFn())
    } else {
      setTimeout(() => prefetchFn(), 1)
    }
  }
}

/**
 * Cache Persistence
 */
export interface CachePersistenceConfig {
  key: string
  storage?: 'localStorage' | 'sessionStorage' | 'indexedDB'
  version?: number
  maxAge?: number
}

export class CachePersistence {
  private config: Required<CachePersistenceConfig>

  constructor(config: CachePersistenceConfig) {
    this.config = {
      storage: 'localStorage',
      version: 1,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      ...config,
    }
  }

  /**
   * Save to storage
   */
  async save(data: unknown): Promise<void> {
    const entry = {
      data,
      version: this.config.version,
      timestamp: Date.now(),
    }

    try {
      if (this.config.storage === 'indexedDB') {
        await this.saveToIndexedDB(entry)
      } else {
        const storage =
          this.config.storage === 'localStorage'
            ? localStorage
            : sessionStorage

        storage.setItem(this.config.key, JSON.stringify(entry))
      }
    } catch (error) {
      console.error('Cache persistence save failed:', error)
    }
  }

  /**
   * Load from storage
   */
  async load(): Promise<unknown | null> {
    try {
      let entry: any

      if (this.config.storage === 'indexedDB') {
        entry = await this.loadFromIndexedDB()
      } else {
        const storage =
          this.config.storage === 'localStorage'
            ? localStorage
            : sessionStorage

        const stored = storage.getItem(this.config.key)
        if (!stored) return null

        entry = JSON.parse(stored)
      }

      if (!entry) return null

      // Check version
      if (entry.version !== this.config.version) {
        await this.remove()
        return null
      }

      // Check age
      const age = Date.now() - entry.timestamp
      if (age > this.config.maxAge) {
        await this.remove()
        return null
      }

      return entry.data
    } catch (error) {
      console.error('Cache persistence load failed:', error)
      return null
    }
  }

  /**
   * Remove from storage
   */
  async remove(): Promise<void> {
    try {
      if (this.config.storage === 'indexedDB') {
        await this.removeFromIndexedDB()
      } else {
        const storage =
          this.config.storage === 'localStorage'
            ? localStorage
            : sessionStorage

        storage.removeItem(this.config.key)
      }
    } catch (error) {
      console.error('Cache persistence remove failed:', error)
    }
  }

  /**
   * Save to IndexedDB
   */
  private async saveToIndexedDB(entry: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('app-cache', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readwrite')
        const store = transaction.objectStore('cache')

        const putRequest = store.put(entry, this.config.key)

        putRequest.onerror = () => reject(putRequest.error)
        putRequest.onsuccess = () => resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache')
        }
      }
    })
  }

  /**
   * Load from IndexedDB
   */
  private async loadFromIndexedDB(): Promise<any | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('app-cache', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readonly')
        const store = transaction.objectStore('cache')

        const getRequest = store.get(this.config.key)

        getRequest.onerror = () => reject(getRequest.error)
        getRequest.onsuccess = () => resolve(getRequest.result || null)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache')
        }
      }
    })
  }

  /**
   * Remove from IndexedDB
   */
  private async removeFromIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('app-cache', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cache'], 'readwrite')
        const store = transaction.objectStore('cache')

        const deleteRequest = store.delete(this.config.key)

        deleteRequest.onerror = () => reject(deleteRequest.error)
        deleteRequest.onsuccess = () => resolve()
      }
    })
  }
}

/**
 * Cache Statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  totalQueries: number
  cacheSize: number
}

export class CacheStatsTracker {
  private hits: number = 0
  private misses: number = 0

  /**
   * Record cache hit
   */
  recordHit(): void {
    this.hits++
  }

  /**
   * Record cache miss
   */
  recordMiss(): void {
    this.misses++
  }

  /**
   * Get statistics
   */
  getStats(): CacheStats {
    const totalQueries = this.hits + this.misses
    const hitRate = totalQueries > 0 ? (this.hits / totalQueries) * 100 : 0

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      totalQueries,
      cacheSize: 0, // Would need cache implementation
    }
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.hits = 0
    this.misses = 0
  }
}

/**
 * Query dedupe helper
 */
export class QueryDeduplicator {
  private pending: Map<string, Promise<unknown>> = new Map()

  /**
   * Deduplicate query
   */
  async dedupe<T>(
    key: string,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    // Check if query is already pending
    const existing = this.pending.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    // Execute query
    const promise = queryFn()

    // Store pending query
    this.pending.set(key, promise)

    // Remove from pending when done
    promise
      .then(() => this.pending.delete(key))
      .catch(() => this.pending.delete(key))

    return promise
  }

  /**
   * Clear pending queries
   */
  clear(): void {
    this.pending.clear()
  }
}
