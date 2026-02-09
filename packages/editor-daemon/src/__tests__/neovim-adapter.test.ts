import { execFile } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NeovimAdapter } from '../adapters/neovim-adapter.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

type ExecFileCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void

function mockExecFile(impl: (cmd: unknown, args: unknown, cb: ExecFileCallback) => void) {
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(impl)
}

describe('NeovimAdapter', () => {
  let adapter: NeovimAdapter
  let serverAdapter: NeovimAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new NeovimAdapter('/usr/bin/nvim')
    serverAdapter = new NeovimAdapter('/usr/bin/nvim', '/tmp/nvim.sock')
  })

  describe('properties', () => {
    it('has correct id and name', () => {
      expect(adapter.id).toBe('neovim')
      expect(adapter.name).toBe('Neovim')
    })
  })

  describe('getCapabilities', () => {
    it('supports openProject, openFile, jumpToLine', () => {
      const caps = adapter.getCapabilities()
      expect(caps.openProject).toBe(true)
      expect(caps.openFile).toBe(true)
      expect(caps.jumpToLine).toBe(true)
    })

    it('does not support applyConfig or installExtension', () => {
      const caps = adapter.getCapabilities()
      expect(caps.applyConfig).toBe(false)
      expect(caps.installExtension).toBe(false)
    })

    it('supports getRunningInstances', () => {
      const caps = adapter.getCapabilities()
      expect(caps.getRunningInstances).toBe(true)
    })
  })

  describe('isAvailable', () => {
    it('returns true when nvim --version succeeds', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: 'NVIM v0.10.0\nBuild type: Release', stderr: '' })
      })
      expect(await adapter.isAvailable()).toBe(true)
    })

    it('returns false when nvim is not found', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('ENOENT'))
      })
      expect(await adapter.isAvailable()).toBe(false)
    })
  })

  describe('getInfo', () => {
    it('returns info with version when available', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: 'NVIM v0.10.0\nBuild type: Release\n', stderr: '' })
      })
      const info = await adapter.getInfo()
      expect(info.id).toBe('neovim')
      expect(info.name).toBe('Neovim')
      expect(info.version).toBe('NVIM v0.10.0')
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

  describe('execute — standalone mode', () => {
    it('open-project calls nvim with path', async () => {
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
        '/usr/bin/nvim',
        ['/home/user/project'],
        expect.any(Function),
      )
    })

    it('open-file with line uses +line syntax', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await adapter.execute({
        type: 'open-file',
        path: '/src/index.ts',
        line: 42,
      })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/nvim',
        ['+42', '/src/index.ts'],
        expect.any(Function),
      )
    })

    it('open-file without line passes plain path', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await adapter.execute({ type: 'open-file', path: '/src/index.ts' })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/nvim',
        ['/src/index.ts'],
        expect.any(Function),
      )
    })
  })

  describe('execute — server mode', () => {
    it('open-project sends :cd command via --remote-send', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      const result = await serverAdapter.execute({
        type: 'open-project',
        path: '/home/user/project',
      })
      expect(result.success).toBe(true)
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/nvim',
        ['--server', '/tmp/nvim.sock', '--remote-send', ':cd /home/user/project<CR>'],
        expect.any(Function),
      )
    })

    it('open-file with line sends :e +line command via --remote-send', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await serverAdapter.execute({
        type: 'open-file',
        path: '/src/index.ts',
        line: 42,
      })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/nvim',
        ['--server', '/tmp/nvim.sock', '--remote-send', ':e +42 /src/index.ts<CR>'],
        expect.any(Function),
      )
    })

    it('open-file without line sends :e command via --remote-send', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      await serverAdapter.execute({
        type: 'open-file',
        path: '/src/index.ts',
      })
      expect(execFile).toHaveBeenCalledWith(
        '/usr/bin/nvim',
        ['--server', '/tmp/nvim.sock', '--remote-send', ':e /src/index.ts<CR>'],
        expect.any(Function),
      )
    })
  })

  describe('execute — common', () => {
    it('get-status returns editor info as data', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: 'NVIM v0.10.0\n', stderr: '' })
      })
      const result = await adapter.execute({ type: 'get-status' })
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({ id: 'neovim', name: 'Neovim' })
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
          editorId: 'neovim',
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
