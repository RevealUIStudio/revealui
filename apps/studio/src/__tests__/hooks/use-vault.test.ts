import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVault } from '../../hooks/use-vault'
import type { SecretInfo } from '../../types'

vi.mock('../../lib/invoke', () => ({
  vaultInit: vi.fn(),
  vaultIsInitialized: vi.fn(),
  vaultList: vi.fn(),
  vaultGet: vi.fn(),
  vaultSet: vi.fn(),
  vaultDelete: vi.fn(),
  vaultSearch: vi.fn(),
}))

const { vaultInit, vaultIsInitialized, vaultList, vaultGet, vaultSet, vaultDelete, vaultSearch } =
  await import('../../lib/invoke')

const MOCK_SECRETS: SecretInfo[] = [
  { path: 'stripe/secret_key', namespace: 'stripe' },
  { path: 'neon/database_url', namespace: 'neon' },
  { path: 'supabase/anon_key', namespace: 'supabase' },
]

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('useVault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(vaultIsInitialized).mockResolvedValue(true)
    vi.mocked(vaultList).mockResolvedValue(MOCK_SECRETS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes vault and loads secrets on mount', async () => {
    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    expect(vaultIsInitialized).toHaveBeenCalledOnce()
    expect(vaultList).toHaveBeenCalled()
    expect(result.current.initialized).toBe(true)
    expect(result.current.secrets).toEqual(MOCK_SECRETS)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('calls vaultInit when not initialized', async () => {
    vi.mocked(vaultIsInitialized).mockResolvedValueOnce(false)
    vi.mocked(vaultInit).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    expect(vaultInit).toHaveBeenCalledOnce()
    expect(result.current.initialized).toBe(true)
  })

  it('handles init error', async () => {
    vi.mocked(vaultIsInitialized).mockRejectedValueOnce(new Error('Keyring locked'))

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    expect(result.current.error).toBe('Keyring locked')
    expect(result.current.initialized).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('selects a secret and loads its value', async () => {
    vi.mocked(vaultGet).mockResolvedValueOnce('sk_test_123')

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.selectSecret('stripe/secret_key')
    })

    expect(vaultGet).toHaveBeenCalledWith('stripe/secret_key')
    expect(result.current.selectedPath).toBe('stripe/secret_key')
    expect(result.current.selectedValue).toBe('sk_test_123')
    expect(result.current.valueLoading).toBe(false)
  })

  it('handles selectSecret error', async () => {
    vi.mocked(vaultGet).mockRejectedValueOnce(new Error('Not found'))

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.selectSecret('missing/key')
    })

    expect(result.current.error).toBe('Not found')
    expect(result.current.valueLoading).toBe(false)
  })

  it('creates a secret and refreshes', async () => {
    vi.mocked(vaultSet).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.createSecret('new/secret', 'value123')
    })

    expect(vaultSet).toHaveBeenCalledWith('new/secret', 'value123', false)
  })

  it('deletes a secret and clears selection if deleted secret was selected', async () => {
    vi.mocked(vaultDelete).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    // Select the secret first
    vi.mocked(vaultGet).mockResolvedValueOnce('value')
    await act(async () => {
      await result.current.selectSecret('stripe/secret_key')
    })

    await act(async () => {
      await result.current.deleteSecret('stripe/secret_key')
    })

    expect(vaultDelete).toHaveBeenCalledWith('stripe/secret_key')
    expect(result.current.selectedPath).toBeNull()
    expect(result.current.selectedValue).toBeNull()
  })

  it('computes namespaces from secrets', async () => {
    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    expect(result.current.namespaces).toEqual(['neon', 'stripe', 'supabase'])
  })

  it('sets search query', async () => {
    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    act(() => {
      result.current.setSearchQuery('stripe')
    })

    expect(result.current.searchQuery).toBe('stripe')
  })

  it('sets active namespace and clears selection', async () => {
    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    // Select a secret first
    vi.mocked(vaultGet).mockResolvedValueOnce('value')
    await act(async () => {
      await result.current.selectSecret('stripe/secret_key')
    })

    act(() => {
      result.current.setActiveNamespace('neon')
    })

    expect(result.current.activeNamespace).toBe('neon')
    expect(result.current.selectedPath).toBeNull()
    expect(result.current.selectedValue).toBeNull()
  })

  it('initStore initializes and loads secrets', async () => {
    vi.mocked(vaultInit).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.initStore()
    })

    expect(vaultInit).toHaveBeenCalled()
    expect(result.current.initialized).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  it('handles initStore error', async () => {
    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    vi.mocked(vaultInit).mockRejectedValueOnce(new Error('Init failed'))

    await act(async () => {
      await result.current.initStore()
    })

    expect(result.current.error).toBe('Init failed')
    expect(result.current.loading).toBe(false)
  })

  it('searches secrets when searchQuery changes', async () => {
    const searchResults: SecretInfo[] = [{ path: 'stripe/secret_key', namespace: 'stripe' }]
    vi.mocked(vaultSearch).mockResolvedValue(searchResults)

    const { result } = renderHook(() => useVault())

    await act(async () => {
      await flushPromises()
    })

    act(() => {
      result.current.setSearchQuery('stripe')
    })

    // Let the useEffect for searchQuery change fire
    await act(async () => {
      await flushPromises()
    })

    expect(vaultSearch).toHaveBeenCalledWith('stripe')
  })
})
