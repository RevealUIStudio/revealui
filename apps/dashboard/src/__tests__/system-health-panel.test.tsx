/**
 * SystemHealthPanel Component Tests
 */

import type { HealthMetrics } from '@revealui/core/monitoring'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemHealthPanel } from '../components/SystemHealthPanel.js'

// Mock fetch
const mockHealthMetrics: HealthMetrics = {
  system: {
    memoryUsage: 512,
    cpuUsage: 25.5,
    uptime: 7200,
    platform: 'linux',
    nodeVersion: 'v24.13.0',
  },
  processes: {
    active: 10,
    zombies: 1,
    failed: 2,
    spawnRate: 5,
    bySource: {
      exec: 6,
      orchestration: 2,
      mcp: 1,
      'ai-runtime': 1,
      'dev-server': 0,
      database: 0,
      unknown: 0,
    },
  },
  database: {
    rest: [
      {
        name: 'pool-1',
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
      },
    ],
    vector: [],
  },
  recentZombies: [
    {
      pid: 1234,
      ppid: 5678,
      command: 'epmd',
      detectedAt: Date.now() - 60000,
    },
  ],
  alerts: [
    {
      level: 'warning',
      metric: 'zombies',
      message: '1 zombie processes detected (threshold: 1)',
      value: 1,
      threshold: 1,
      timestamp: Date.now(),
    },
  ],
  timestamp: Date.now(),
}

const mockProcesses = {
  processes: [
    {
      pid: 1234,
      command: 'node',
      args: ['server.js'],
      source: 'exec',
      status: 'running',
      startTime: Date.now() - 120000,
    },
    {
      pid: 5678,
      command: 'pnpm',
      args: ['dev'],
      source: 'dev-server',
      status: 'running',
      startTime: Date.now() - 300000,
    },
  ],
  total: 2,
  filtered: 2,
}

global.fetch = vi.fn()

describe('SystemHealthPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/health-monitoring') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockHealthMetrics),
        })
      } else if (url.startsWith('/api/health-monitoring/processes')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockProcesses),
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    render(<SystemHealthPanel />)
    expect(screen.getByText(/loading health metrics/i)).toBeInTheDocument()
  })

  it('should fetch and display health metrics', async () => {
    render(<SystemHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText('512MB')).toBeInTheDocument() // Memory
      expect(screen.getByText('25.5%')).toBeInTheDocument() // CPU
      expect(screen.getByText('2h')).toBeInTheDocument() // Uptime (2 hours = 7200 seconds)
      expect(screen.getByText('10')).toBeInTheDocument() // Active processes
    })
  })

  it('should display active alerts', async () => {
    render(<SystemHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText(/active alerts/i)).toBeInTheDocument()
      expect(screen.getByText(/1 zombie processes detected/i)).toBeInTheDocument()
    })
  })

  it('should display process statistics', async () => {
    render(<SystemHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText(/process statistics/i)).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // Active
      expect(screen.getByText('1')).toBeInTheDocument() // Zombies
      expect(screen.getByText('2')).toBeInTheDocument() // Failed
      expect(screen.getByText('5/min')).toBeInTheDocument() // Spawn rate
    })
  })

  it('should display database pool metrics', async () => {
    render(<SystemHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText(/database pools/i)).toBeInTheDocument()
      expect(screen.getByText(/5\/10 active/i)).toBeInTheDocument()
    })
  })

  it('should display process list when enabled', async () => {
    render(<SystemHealthPanel showProcessList={true} />)

    await waitFor(() => {
      expect(screen.getByText(/recent processes/i)).toBeInTheDocument()
      expect(screen.getByText('1234')).toBeInTheDocument()
      expect(screen.getByText('5678')).toBeInTheDocument()
    })
  })

  it('should not display process list when disabled', async () => {
    render(<SystemHealthPanel showProcessList={false} />)

    await waitFor(() => {
      expect(screen.queryByText(/recent processes/i)).not.toBeInTheDocument()
    })
  })

  it('should display recent zombie processes', async () => {
    render(<SystemHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText(/recent zombie processes/i)).toBeInTheDocument()
      expect(screen.getByText(/PID 1234/i)).toBeInTheDocument()
      expect(screen.getByText('epmd')).toBeInTheDocument()
    })
  })

  it('should poll for updates at specified interval', async () => {
    const pollInterval = 1000
    render(<SystemHealthPanel pollInterval={pollInterval} />)

    // Initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2) // health + processes
    })

    // Clear previous calls
    vi.clearAllMocks()

    // Advance timer by poll interval
    vi.advanceTimersByTime(pollInterval)

    // Should have polled again
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle fetch errors gracefully', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      }),
    )

    render(<SystemHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText(/health monitoring unavailable/i)).toBeInTheDocument()
    })
  })

  it('should filter processes by source', async () => {
    const { getByRole } = render(<SystemHealthPanel showProcessList={true} />)

    await waitFor(() => {
      expect(screen.getByText(/recent processes/i)).toBeInTheDocument()
    })

    // Find the source filter select
    const sourceSelect = getByRole('combobox', { name: /all sources/i }) as HTMLSelectElement

    // Change to 'exec'
    sourceSelect.value = 'exec'
    sourceSelect.dispatchEvent(new Event('change', { bubbles: true }))

    // Verify fetch was called with source filter
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('source=exec'))
    })
  })

  it('should filter processes by status', async () => {
    const { getByRole } = render(<SystemHealthPanel showProcessList={true} />)

    await waitFor(() => {
      expect(screen.getByText(/recent processes/i)).toBeInTheDocument()
    })

    // Find the status filter select
    const statusSelect = getByRole('combobox', { name: /all status/i }) as HTMLSelectElement

    // Change to 'running'
    statusSelect.value = 'running'
    statusSelect.dispatchEvent(new Event('change', { bubbles: true }))

    // Verify fetch was called with status filter
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('status=running'))
    })
  })
})
