import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { diffConfig, syncConfig } from '../config/config-sync.js'
import {
  getConfigurableEditors,
  getLocalConfigPath,
  getSsdConfigPath,
} from '../config/editor-config-paths.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}))

const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>
const mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>
const mockMkdir = mkdir as unknown as ReturnType<typeof vi.fn>

describe('editor-config-paths', () => {
  it('returns config path for known editors', () => {
    expect(getLocalConfigPath('zed')).toContain('zed')
    expect(getLocalConfigPath('vscode')).toContain('Code')
    expect(getLocalConfigPath('neovim')).toContain('nvim')
  })

  it('returns undefined for unknown editors', () => {
    expect(getLocalConfigPath('emacs')).toBeUndefined()
  })

  it('returns SSD path for known editors', () => {
    const path = getSsdConfigPath('zed', '/mnt/ssd')
    expect(path).toContain('/mnt/ssd')
    expect(path).toContain('editor-configs')
    expect(path).toContain('zed')
  })

  it('returns undefined SSD path for unknown editors', () => {
    expect(getSsdConfigPath('emacs', '/mnt/ssd')).toBeUndefined()
  })

  it('lists all configurable editors', () => {
    const editors = getConfigurableEditors()
    expect(editors).toContain('zed')
    expect(editors).toContain('vscode')
    expect(editors).toContain('neovim')
  })
})

describe('syncConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
  })

  it('push: copies SSD config to local', async () => {
    mockReadFile.mockResolvedValue('{"theme":"dark"}')
    const result = await syncConfig('zed', 'push', '/mnt/ssd')
    expect(result.success).toBe(true)
    expect(result.direction).toBe('push')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('zed'),
      '{"theme":"dark"}',
      'utf-8',
    )
  })

  it('pull: copies local config to SSD', async () => {
    mockReadFile.mockResolvedValue('{"editor.fontSize":14}')
    const result = await syncConfig('vscode', 'pull', '/mnt/ssd')
    expect(result.success).toBe(true)
    expect(result.direction).toBe('pull')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('editor-configs'),
      '{"editor.fontSize":14}',
      'utf-8',
    )
  })

  it('fails when source file does not exist (push)', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    const result = await syncConfig('zed', 'push', '/mnt/ssd')
    expect(result.success).toBe(false)
    expect(result.message).toContain('SSD config not found')
  })

  it('fails when source file does not exist (pull)', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    const result = await syncConfig('zed', 'pull', '/mnt/ssd')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Local config not found')
  })

  it('fails for unknown editor', async () => {
    const result = await syncConfig('emacs', 'push', '/mnt/ssd')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Unknown editor')
  })

  it('creates parent directories before writing', async () => {
    mockReadFile.mockResolvedValue('content')
    await syncConfig('zed', 'push', '/mnt/ssd')
    expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true })
  })
})

describe('diffConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports both files exist and are identical', async () => {
    mockReadFile.mockResolvedValue('same content')
    const result = await diffConfig('zed', '/mnt/ssd')
    expect(result.localExists).toBe(true)
    expect(result.ssdExists).toBe(true)
    expect(result.identical).toBe(true)
  })

  it('reports files differ', async () => {
    let callCount = 0
    mockReadFile.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount === 1 ? 'local content' : 'ssd content')
    })
    const result = await diffConfig('zed', '/mnt/ssd')
    expect(result.localExists).toBe(true)
    expect(result.ssdExists).toBe(true)
    expect(result.identical).toBe(false)
  })

  it('reports missing local file', async () => {
    let callCount = 0
    mockReadFile.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('ENOENT'))
      return Promise.resolve('ssd content')
    })
    const result = await diffConfig('zed', '/mnt/ssd')
    expect(result.localExists).toBe(false)
    expect(result.ssdExists).toBe(true)
    expect(result.identical).toBe(false)
  })

  it('reports missing SSD file', async () => {
    let callCount = 0
    mockReadFile.mockImplementation(() => {
      callCount++
      if (callCount === 2) return Promise.reject(new Error('ENOENT'))
      return Promise.resolve('local content')
    })
    const result = await diffConfig('zed', '/mnt/ssd')
    expect(result.localExists).toBe(true)
    expect(result.ssdExists).toBe(false)
    expect(result.identical).toBe(false)
  })

  it('handles unknown editor', async () => {
    const result = await diffConfig('emacs', '/mnt/ssd')
    expect(result.localExists).toBe(false)
    expect(result.ssdExists).toBe(false)
    expect(result.identical).toBe(false)
  })
})
