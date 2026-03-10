import { describe, expect, it } from 'vitest'
import { createDataloaderCacheKey } from '../dataloader.js'

// ---------------------------------------------------------------------------
// Tests — createDataloaderCacheKey
// ---------------------------------------------------------------------------
describe('createDataloaderCacheKey', () => {
  const baseArgs = {
    collectionSlug: 'posts',
    currentDepth: 1,
    depth: 2,
    docID: 'doc-1' as string | number,
    draft: false,
    fallbackLocale: 'en' as const,
    locale: 'en' as string | string[],
    overrideAccess: false,
    showHiddenFields: false,
    transactionID: undefined as string | number | undefined,
  }

  it('produces a JSON string', () => {
    const key = createDataloaderCacheKey(baseArgs)
    expect(() => JSON.parse(key)).not.toThrow()
  })

  it('includes all key components', () => {
    const key = createDataloaderCacheKey(baseArgs)
    const parsed = JSON.parse(key)

    expect(parsed).toContain('posts')
    expect(parsed).toContain('doc-1')
    expect(parsed).toContain('en')
  })

  it('produces different keys for different collections', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, collectionSlug: 'users' })

    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different doc IDs', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, docID: 'doc-2' })

    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different depth', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, depth: 3 })

    expect(key1).not.toBe(key2)
  })

  it('produces different keys for draft vs non-draft', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, draft: true })

    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different locales', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, locale: 'fr' })

    expect(key1).not.toBe(key2)
  })

  it('produces different keys for overrideAccess', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, overrideAccess: true })

    expect(key1).not.toBe(key2)
  })

  it('produces different keys with select', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, select: { title: true } })

    expect(key1).not.toBe(key2)
  })

  it('produces same key for same inputs', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey(baseArgs)

    expect(key1).toBe(key2)
  })

  it('handles numeric doc IDs', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, docID: 42 })
    const parsed = JSON.parse(key)

    expect(parsed).toContain(42)
  })

  it('handles transaction ID', () => {
    const key1 = createDataloaderCacheKey(baseArgs)
    const key2 = createDataloaderCacheKey({ ...baseArgs, transactionID: 'tx-1' })

    expect(key1).not.toBe(key2)
  })

  it('handles locale array', () => {
    const key = createDataloaderCacheKey({ ...baseArgs, locale: ['en', 'fr'] })
    const parsed = JSON.parse(key)

    // Locale array should be serialized
    expect(JSON.stringify(parsed)).toContain('en')
    expect(JSON.stringify(parsed)).toContain('fr')
  })
})
