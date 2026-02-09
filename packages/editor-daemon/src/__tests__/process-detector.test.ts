import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findAllEditorProcesses,
  findEditorProcesses,
  findNeovimSockets,
  findProcesses,
} from '../detection/process-detector.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}))

type ExecFileCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void

function mockExecFile(impl: (cmd: unknown, args: unknown, cb: ExecFileCallback) => void) {
  ;(execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(impl)
}

describe('process-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findProcesses', () => {
    it('parses pgrep output into pid and command', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '1234 /usr/bin/zed\n5678 /usr/bin/zed --new-window\n', stderr: '' })
      })
      const result = await findProcesses('zed')
      expect(result).toEqual([
        { pid: 1234, command: '/usr/bin/zed' },
        { pid: 5678, command: '/usr/bin/zed --new-window' },
      ])
    })

    it('returns empty array when no processes match', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(new Error('exit code 1'))
      })
      const result = await findProcesses('zed')
      expect(result).toEqual([])
    })

    it('handles empty stdout', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '', stderr: '' })
      })
      const result = await findProcesses('zed')
      expect(result).toEqual([])
    })
  })

  describe('findNeovimSockets', () => {
    it('finds nvim socket files in /tmp', async () => {
      ;(readdir as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        'nvim.user.sock',
        'other-file.txt',
        'nvim-backup.sock',
      ])
      const result = await findNeovimSockets()
      expect(result).toContain('/tmp/nvim.user.sock')
      expect(result).toContain('/tmp/nvim-backup.sock')
      expect(result).not.toContain('/tmp/other-file.txt')
    })

    it('returns empty array when directory read fails', async () => {
      ;(readdir as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'))
      const result = await findNeovimSockets()
      expect(result).toEqual([])
    })
  })

  describe('findEditorProcesses', () => {
    it('returns processes for known editor', async () => {
      mockExecFile((_cmd, _args, cb) => {
        cb(null, { stdout: '1234 /usr/bin/zed\n', stderr: '' })
      })
      const result = await findEditorProcesses('zed')
      expect(result).toEqual([{ pid: 1234, command: '/usr/bin/zed', editorId: 'zed' }])
    })

    it('returns empty array for unknown editor', async () => {
      const result = await findEditorProcesses('unknown-editor')
      expect(result).toEqual([])
    })
  })

  describe('findAllEditorProcesses', () => {
    it('aggregates processes from all editors', async () => {
      mockExecFile((_cmd, args, cb) => {
        const pattern = (args as string[])[1]
        if (pattern === 'zed') {
          cb(null, { stdout: '100 /usr/bin/zed\n', stderr: '' })
        } else if (pattern === 'code') {
          cb(null, { stdout: '200 /usr/bin/code\n', stderr: '' })
        } else if (pattern === 'nvim') {
          cb(new Error('no match'))
        } else {
          cb(new Error('no match'))
        }
      })
      const result = await findAllEditorProcesses()
      expect(result).toContainEqual({ pid: 100, command: '/usr/bin/zed', editorId: 'zed' })
      expect(result).toContainEqual({ pid: 200, command: '/usr/bin/code', editorId: 'vscode' })
    })
  })
})
