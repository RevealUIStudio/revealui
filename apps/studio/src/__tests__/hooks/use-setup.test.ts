import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSetupComplete, markSetupComplete, useSetup } from '../../hooks/use-setup'
import type { SetupStatus } from '../../types'

vi.mock('../../lib/invoke', () => ({
  checkSetup: vi.fn(),
  mountDevbox: vi.fn(),
  setGitIdentity: vi.fn(),
}))

const { checkSetup, mountDevbox, setGitIdentity } = await import('../../lib/invoke')

const MOCK_STATUS: SetupStatus = {
  wsl_running: true,
  nix_installed: true,
  devbox_mounted: false,
  git_name: 'Test User',
  git_email: 'test@example.com',
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('isSetupComplete / markSetupComplete', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when localStorage key is absent', () => {
    expect(isSetupComplete()).toBe(false)
  })

  it('returns true after marking setup complete', () => {
    markSetupComplete()
    expect(isSetupComplete()).toBe(true)
  })
})

describe('useSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(checkSetup).mockResolvedValue(MOCK_STATUS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches setup status on mount', async () => {
    const { result } = renderHook(() => useSetup())

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await flushPromises()
    })

    expect(checkSetup).toHaveBeenCalledOnce()
    expect(result.current.loading).toBe(false)
    expect(result.current.status).toEqual(MOCK_STATUS)
    expect(result.current.gitName).toBe('Test User')
    expect(result.current.gitEmail).toBe('test@example.com')
    expect(result.current.error).toBeNull()
  })

  it('handles checkSetup failure', async () => {
    vi.mocked(checkSetup).mockRejectedValueOnce(new Error('WSL not running'))

    const { result } = renderHook(() => useSetup())

    await act(async () => {
      await flushPromises()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('WSL not running')
    expect(result.current.status).toBeNull()
  })

  it('saves git identity', async () => {
    vi.mocked(setGitIdentity).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useSetup())

    await act(async () => {
      await flushPromises()
    })

    act(() => {
      result.current.setGitName('New Name')
      result.current.setGitEmail('new@example.com')
    })

    await act(async () => {
      await result.current.saveGitIdentity()
    })

    expect(setGitIdentity).toHaveBeenCalledWith('New Name', 'new@example.com')
    expect(result.current.saving).toBe(false)
  })

  it('handles git identity save error', async () => {
    vi.mocked(setGitIdentity).mockRejectedValueOnce(new Error('Permission denied'))

    const { result } = renderHook(() => useSetup())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.saveGitIdentity()
    })

    expect(result.current.error).toBe('Permission denied')
    expect(result.current.saving).toBe(false)
  })

  it('mounts devbox and refreshes status', async () => {
    vi.mocked(mountDevbox).mockResolvedValueOnce('Mounted')

    const { result } = renderHook(() => useSetup())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.doMount()
    })

    expect(mountDevbox).toHaveBeenCalledOnce()
    expect(result.current.mounting).toBe(false)
    // checkSetup called: once on mount + once after doMount's refresh
    expect(checkSetup).toHaveBeenCalledTimes(2)
  })

  it('handles mount error', async () => {
    vi.mocked(mountDevbox).mockRejectedValueOnce(new Error('No device'))

    const { result } = renderHook(() => useSetup())

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      await result.current.doMount()
    })

    expect(result.current.error).toBe('No device')
    expect(result.current.mounting).toBe(false)
  })

  it('preserves user-edited git name/email after refresh', async () => {
    const { result } = renderHook(() => useSetup())

    await act(async () => {
      await flushPromises()
    })

    act(() => {
      result.current.setGitName('Edited Name')
    })

    await act(async () => {
      await result.current.refresh()
    })

    // refresh should not overwrite user-edited values (prev.gitName is truthy)
    expect(result.current.gitName).toBe('Edited Name')
  })
})
