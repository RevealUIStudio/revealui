import { execFile } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autoDetectEditors } from '../detection/auto-detector.js'
import { EditorRegistry } from '../registry/editor-registry.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

type ExecFileCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void

describe('autoDetectEditors', () => {
  let registry: EditorRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new EditorRegistry()
  })

  it('registers editors that are available', async () => {
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, _args: unknown, cb: ExecFileCallback) => {
        if (cmd === 'zed') {
          cb(null, { stdout: 'Zed 0.150.0', stderr: '' })
        } else if (cmd === 'code') {
          cb(null, { stdout: '1.85.0\nabc\nx64', stderr: '' })
        } else if (cmd === 'nvim') {
          cb(null, { stdout: 'NVIM v0.10.0', stderr: '' })
        } else {
          cb(new Error('ENOENT'))
        }
      },
    )
    const detected = await autoDetectEditors(registry)
    expect(detected).toContain('zed')
    expect(detected).toContain('vscode')
    expect(detected).toContain('neovim')
    expect(registry.listAll()).toEqual(['zed', 'vscode', 'neovim'])
  })

  it('skips editors that are not available', async () => {
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, _args: unknown, cb: ExecFileCallback) => {
        if (cmd === 'zed') {
          cb(null, { stdout: 'Zed 0.150.0', stderr: '' })
        } else {
          cb(new Error('ENOENT'))
        }
      },
    )
    const detected = await autoDetectEditors(registry)
    expect(detected).toEqual(['zed'])
    expect(registry.listAll()).toEqual(['zed'])
  })

  it('returns empty array when no editors are available', async () => {
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_cmd: unknown, _args: unknown, cb: ExecFileCallback) => {
        cb(new Error('ENOENT'))
      },
    )
    const detected = await autoDetectEditors(registry)
    expect(detected).toEqual([])
    expect(registry.listAll()).toEqual([])
  })

  it('disposes adapters that are not available', async () => {
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_cmd: unknown, _args: unknown, cb: ExecFileCallback) => {
        cb(new Error('ENOENT'))
      },
    )
    // Should not throw — dispose is called on unavailable adapters
    await expect(autoDetectEditors(registry)).resolves.toEqual([])
  })

  it('detected editors can execute commands', async () => {
    ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cmd: string, _args: unknown, cb: ExecFileCallback) => {
        if (cmd === 'code') {
          cb(null, { stdout: '1.85.0\nabc\nx64', stderr: '' })
        } else {
          cb(new Error('ENOENT'))
        }
      },
    )
    await autoDetectEditors(registry)
    const adapter = registry.get('vscode')
    expect(adapter).toBeDefined()
    const info = await adapter!.getInfo()
    expect(info.id).toBe('vscode')
    expect(info.version).toBe('1.85.0')
  })
})
