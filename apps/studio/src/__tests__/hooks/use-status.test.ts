import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStatus, useStatusContext } from '../../hooks/use-status'
import type { MountStatus, SystemStatus } from '../../types'

vi.mock('../../lib/invoke', () => ({
  getSystemStatus: vi.fn(),
  getMountStatus: vi.fn(),
}))

const { getSystemStatus, getMountStatus } = await import('../../lib/invoke')

const MOCK_SYSTEM: SystemStatus = {
  wsl_running: true,
  distribution: 'Ubuntu-24.04',
  tier: 'pro',
  systemd_status: 'running',
}

const MOCK_MOUNT: MountStatus = {
  mounted: true,
  mount_point: '/mnt/wsl-dev',
  device: '/dev/sdc',
  size_total: '1T',
  size_used: '500G',
  size_available: '500G',
  use_percent: '50%',
}

describe('useStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    vi.mocked(getSystemStatus).mockResolvedValue(MOCK_SYSTEM)
    vi.mocked(getMountStatus).mockResolvedValue(MOCK_MOUNT)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('fetches system and mount status on mount', async () => {
    const { result } = renderHook(() => useStatus())

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.system).toEqual(MOCK_SYSTEM)
    expect(result.current.mount).toEqual(MOCK_MOUNT)
    expect(result.current.error).toBeNull()
  })

  it('handles fetch error', async () => {
    vi.mocked(getSystemStatus).mockRejectedValueOnce(new Error('IPC failed'))

    const { result } = renderHook(() => useStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('IPC failed')
  })

  it('polls status on 30s interval', async () => {
    const { result } = renderHook(() => useStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    expect(getSystemStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(getSystemStatus).toHaveBeenCalledTimes(2)
  })

  it('clears interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    // Only the initial fetch
    expect(getSystemStatus).toHaveBeenCalledTimes(1)
  })

  it('refresh can be called manually', async () => {
    const { result } = renderHook(() => useStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(getSystemStatus).toHaveBeenCalledTimes(2)
    expect(getMountStatus).toHaveBeenCalledTimes(2)
  })
})

describe('useStatusContext', () => {
  it('throws when used outside StatusContext provider', () => {
    expect(() => {
      renderHook(() => useStatusContext())
    }).toThrow('useStatusContext must be used inside AppShell')
  })
})
