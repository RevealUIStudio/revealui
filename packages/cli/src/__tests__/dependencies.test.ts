import { describe, expect, it, vi } from 'vitest'

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

// Mock ora
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }),
}))

// Mock the logger
vi.mock('@revealui/setup/utils', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    header: vi.fn(),
    divider: vi.fn(),
  }),
}))

import { execa } from 'execa'
import {
  checkPnpmVersion,
  installDependencies,
  isPnpmInstalled,
} from '../installers/dependencies.js'

const mockExeca = vi.mocked(execa)

describe('installDependencies', () => {
  it('runs pnpm install in the project path', async () => {
    mockExeca.mockResolvedValueOnce({} as ReturnType<typeof execa>)
    await installDependencies('/my/project')
    expect(mockExeca).toHaveBeenCalledWith('pnpm', ['install'], {
      cwd: '/my/project',
      stdio: 'pipe',
    })
  })

  it('throws when pnpm install fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('install failed'))
    await expect(installDependencies('/my/project')).rejects.toThrow('install failed')
  })
})

describe('isPnpmInstalled', () => {
  it('returns true when pnpm is available', async () => {
    mockExeca.mockResolvedValueOnce({} as ReturnType<typeof execa>)
    expect(await isPnpmInstalled()).toBe(true)
  })

  it('returns false when pnpm is not available', async () => {
    mockExeca.mockRejectedValueOnce(new Error('not found'))
    expect(await isPnpmInstalled()).toBe(false)
  })
})

describe('checkPnpmVersion', () => {
  it('returns valid for pnpm 10.28.2', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '10.28.2' } as ReturnType<typeof execa>)
    const result = await checkPnpmVersion()
    expect(result).toEqual({ version: '10.28.2', valid: true })
  })

  it('returns valid for pnpm 11.0.0', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '11.0.0' } as ReturnType<typeof execa>)
    const result = await checkPnpmVersion()
    expect(result).toEqual({ version: '11.0.0', valid: true })
  })

  it('returns invalid for pnpm 10.27.0', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '10.27.0' } as ReturnType<typeof execa>)
    const result = await checkPnpmVersion()
    expect(result).toEqual({ version: '10.27.0', valid: false })
  })

  it('returns invalid for pnpm 9.0.0', async () => {
    mockExeca.mockResolvedValueOnce({ stdout: '9.0.0' } as ReturnType<typeof execa>)
    const result = await checkPnpmVersion()
    expect(result).toEqual({ version: '9.0.0', valid: false })
  })

  it('returns unknown version when pnpm check fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('not found'))
    const result = await checkPnpmVersion()
    expect(result).toEqual({ version: 'unknown', valid: false })
  })
})
