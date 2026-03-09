import { describe, expect, it, vi } from 'vitest'

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
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
import { createInitialCommit, initializeGitRepo, isGitInstalled } from '../utils/git.js'

const mockExeca = vi.mocked(execa)

describe('initializeGitRepo', () => {
  it('runs git init in the project path', async () => {
    mockExeca.mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>)
    await initializeGitRepo('/my/project')
    expect(mockExeca).toHaveBeenCalledWith('git', ['init'], { cwd: '/my/project' })
  })

  it('throws when git init fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('git not found'))
    await expect(initializeGitRepo('/my/project')).rejects.toThrow('git not found')
  })
})

describe('createInitialCommit', () => {
  it('runs git add and git commit', async () => {
    mockExeca.mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>)
    mockExeca.mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>)
    await createInitialCommit('/my/project')
    expect(mockExeca).toHaveBeenCalledWith('git', ['add', '.'], { cwd: '/my/project' })
    expect(mockExeca).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'Initial commit from @revealui/cli'],
      {
        cwd: '/my/project',
      },
    )
  })

  it('throws when git add fails', async () => {
    mockExeca.mockRejectedValueOnce(new Error('add failed'))
    await expect(createInitialCommit('/my/project')).rejects.toThrow('add failed')
  })
})

describe('isGitInstalled', () => {
  it('returns true when git is available', async () => {
    mockExeca.mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>)
    expect(await isGitInstalled()).toBe(true)
  })

  it('returns false when git is not available', async () => {
    mockExeca.mockRejectedValueOnce(new Error('not found'))
    expect(await isGitInstalled()).toBe(false)
  })
})
