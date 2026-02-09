import { execFile } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VscodeAdapter } from '../adapters/vscode-adapter.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

type ExecFileCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void

function mockExecFile(impl: (cmd: unknown, args: unknown, cb: ExecFileCallback) => void) {
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(impl)
}

describe('VscodeAdapter', () => {
  let adapter: VscodeAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new VscodeAdapter('/usr/bin/code')
  })

  describe('properties', () => {
    it('has correct id and name', () => {
      expect(adapter.id).toBe('vscode')
      expect(adapter.name).toBe('VS Code')
    })
  })

  describe('getCapabilities', () => {
    it('supports openProject, openFile, jumpToLine, installExtension', () => {
      const caps = adapter.getCapabilities()
      expect(caps.openProject).toBe(true)
      expect(caps.openFile).toBe(true)
      expect(caps.jumpToLine).toBe(true)
      expect(caps.installExtension).toBe(true)
    })

    it('supports applyConfig and getRunningInstances', () => {
      const caps = adapter.getCapabilities()
      expect(caps.applyConfig).toBe(true)
      expect(caps.getRunningInstances).toBe(true)
    })
  })

  describe('isAvailable', () => {
    it('returns true when code --version succeeds', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '1.85.0\nabc123\nx64', stderr: '' })
      })
      expect(await adapter.isAvailable()).toBe(true)
    })

    it('returns false when code is not found', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('ENOENT'))
      })
      expect(await adapter.isAvailable()).toBe(false)
    })
  })

  describe('getInfo', () => {
    it('returns info with version when available', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '1.85.0\nabc123\nx64\n', stderr: '' })
      })
      const info = await adapter.getInfo()
      expect(info.id).toBe('vscode')
      expect(info.name).toBe('VS Code')
      expect(info.version).toBe('1.85.0')
      expect(info.capabilities.openProject).toBe(true)
    })

    it('returns info without version when unavailable', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('ENOENT'))
      })
      const info = await adapter.getInfo()
      expect(info.version).toBeUndefined()
    })
  })

  describe('execute', () => {
    it('open-project calls code with path', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      const result = await adapter.execute({
        type: 'open-project',
        path: '/home/user/project',
      })
      expect(result.success).toBe(true)
      expect(result.command).toBe('open-project')
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/code',
        ['/home/user/project'],
        expect.any(Function),
      )
    })

    it('open-file with line and column formats path correctly', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await adapter.execute({
        type: 'open-file',
        path: '/src/index.ts',
        line: 42,
        column: 10,
      })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/code',
        ['--goto', '/src/index.ts:42:10'],
        expect.any(Function),
      )
    })

    it('open-file with line only omits column', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await adapter.execute({
        type: 'open-file',
        path: '/src/index.ts',
        line: 7,
      })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/code',
        ['--goto', '/src/index.ts:7'],
        expect.any(Function),
      )
    })

    it('open-file without line passes plain path', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await adapter.execute({ type: 'open-file', path: '/src/index.ts' })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/code',
        ['--goto', '/src/index.ts'],
        expect.any(Function),
      )
    })

    it('install-extension calls code with --install-extension', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      const result = await adapter.execute({
        type: 'install-extension',
        extensionId: 'esbenp.prettier-vscode',
      })
      expect(result.success).toBe(true)
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/code',
        ['--install-extension', 'esbenp.prettier-vscode'],
        expect.any(Function),
      )
    })

    it('get-status returns editor info as data', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '1.85.0\nabc123\nx64\n', stderr: '' })
      })
      const result = await adapter.execute({ type: 'get-status' })
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({ id: 'vscode', name: 'VS Code' })
    })

    it('unsupported command returns failure', async () => {
      const result = await adapter.execute({
        type: 'apply-config',
        config: {},
      })
      expect(result.success).toBe(false)
      expect(result.message).toContain('Unsupported')
    })

    it('emits error event on failure', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('Process crashed'))
      })
      const handler = vi.fn()
      adapter.onEvent(handler)

      await adapter.execute({ type: 'open-project', path: '/tmp' })

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          editorId: 'vscode',
          error: 'Process crashed',
        }),
      )
    })
  })

  describe('onEvent', () => {
    it('returns an unsubscribe function', () => {
      const handler = vi.fn()
      const unsub = adapter.onEvent(handler)
      expect(typeof unsub).toBe('function')
    })

    it('unsubscribe prevents further events', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('fail'))
      })
      const handler = vi.fn()
      const unsub = adapter.onEvent(handler)
      unsub()

      await adapter.execute({ type: 'open-project', path: '/tmp' })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('clears all event handlers', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('fail'))
      })
      const handler = vi.fn()
      adapter.onEvent(handler)

      await adapter.dispose()
      await adapter.execute({ type: 'open-project', path: '/tmp' })
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
