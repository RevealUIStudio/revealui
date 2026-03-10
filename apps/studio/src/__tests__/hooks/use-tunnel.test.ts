import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTunnel } from '../../hooks/use-tunnel'
import type { TailscaleStatus } from '../../types'

vi.mock('../../lib/invoke', () => ({
  getTailscaleStatus: vi.fn(),
  tailscaleUp: vi.fn(),
  tailscaleDown: vi.fn(),
}))

const { getTailscaleStatus, tailscaleUp, tailscaleDown } = await import('../../lib/invoke')

const MOCK_STATUS: TailscaleStatus = {
  running: true,
  ip: '100.64.0.1',
  hostname: 'studio-dev',
  peers: [{ hostname: 'server-1', ip: '100.64.0.2', online: true, os: 'linux' }],
}

describe('useTunnel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    vi.mocked(getTailscaleStatus).mockResolvedValue(MOCK_STATUS)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('fetches tailscale status on mount', async () => {
    const { result } = renderHook(() => useTunnel())

    expect(result.current.loading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.status).toEqual(MOCK_STATUS)
    expect(result.current.error).toBeNull()
  })

  it('handles fetch error', async () => {
    vi.mocked(getTailscaleStatus).mockRejectedValueOnce(new Error('Not installed'))

    const { result } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Not installed')
    expect(result.current.status).toBeNull()
  })

  it('connects tailscale', async () => {
    vi.mocked(tailscaleUp).mockResolvedValueOnce('Connected')

    const { result } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    await act(async () => {
      await result.current.up()
    })

    expect(tailscaleUp).toHaveBeenCalledOnce()
    expect(result.current.toggling).toBe(false)
  })

  it('handles tailscaleUp error', async () => {
    vi.mocked(tailscaleUp).mockRejectedValueOnce(new Error('Auth required'))

    const { result } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    await act(async () => {
      await result.current.up()
    })

    expect(result.current.error).toBe('Auth required')
    expect(result.current.toggling).toBe(false)
  })

  it('disconnects tailscale', async () => {
    vi.mocked(tailscaleDown).mockResolvedValueOnce('Disconnected')

    const { result } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    await act(async () => {
      await result.current.down()
    })

    expect(tailscaleDown).toHaveBeenCalledOnce()
    expect(result.current.toggling).toBe(false)
  })

  it('handles tailscaleDown error', async () => {
    vi.mocked(tailscaleDown).mockRejectedValueOnce(new Error('Timeout'))

    const { result } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    await act(async () => {
      await result.current.down()
    })

    expect(result.current.error).toBe('Timeout')
    expect(result.current.toggling).toBe(false)
  })

  it('polls on 10s interval', async () => {
    const { result } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    expect(getTailscaleStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(getTailscaleStatus).toHaveBeenCalledTimes(2)
  })

  it('clears interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useTunnel())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })

    expect(result.current.loading).toBe(false)
    unmount()

    const callCount = vi.mocked(getTailscaleStatus).mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(vi.mocked(getTailscaleStatus).mock.calls.length).toBe(callCount)
  })
})
