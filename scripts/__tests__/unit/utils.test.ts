import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  debounce,
  ensureArray,
  fileExists,
  formatBytes,
  formatDuration,
  generateId,
  readFileContent,
  readFileIfExists,
  requireEnv,
  sleep,
  truncate,
  validateDependencies,
  waitFor,
  writeFileContent,
} from '../lib/utils.js'

describe('File Utilities', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'utils-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('readFileContent', () => {
    it('reads file contents as string', async () => {
      const filePath = join(tempDir, 'test.txt')
      await writeFile(filePath, 'Hello, World!', 'utf-8')

      const content = await readFileContent(filePath)
      expect(content).toBe('Hello, World!')
    })

    it('throws error for non-existent file', async () => {
      await expect(readFileContent(join(tempDir, 'nonexistent.txt'))).rejects.toThrow()
    })
  })

  describe('writeFileContent', () => {
    it('writes content to file', async () => {
      const filePath = join(tempDir, 'output.txt')
      await writeFileContent(filePath, 'Test content')

      const content = await readFileContent(filePath)
      expect(content).toBe('Test content')
    })
  })

  describe('fileExists', () => {
    it('returns true for existing file', async () => {
      const filePath = join(tempDir, 'exists.txt')
      await writeFile(filePath, 'content', 'utf-8')

      const exists = await fileExists(filePath)
      expect(exists).toBe(true)
    })

    it('returns false for non-existent file', async () => {
      const exists = await fileExists(join(tempDir, 'nonexistent.txt'))
      expect(exists).toBe(false)
    })
  })

  describe('readFileIfExists', () => {
    it('returns content for existing file', async () => {
      const filePath = join(tempDir, 'test.txt')
      await writeFile(filePath, 'Hello!', 'utf-8')

      const content = await readFileIfExists(filePath)
      expect(content).toBe('Hello!')
    })

    it('returns null for non-existent file', async () => {
      const content = await readFileIfExists(join(tempDir, 'nonexistent.txt'))
      expect(content).toBeNull()
    })
  })
})

describe('Async Utilities', () => {
  describe('sleep', () => {
    it('waits for specified milliseconds', async () => {
      const start = Date.now()
      await sleep(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some tolerance
      expect(elapsed).toBeLessThan(200)
    })
  })

  describe('waitFor', () => {
    it('returns true when condition is met', async () => {
      let counter = 0
      const condition = () => ++counter >= 3

      const result = await waitFor(condition, 5000, 10)
      expect(result).toBe(true)
    })

    it('returns false when timeout is reached', async () => {
      const condition = () => false

      const result = await waitFor(condition, 100, 10)
      expect(result).toBe(false)
    })

    it('works with async conditions', async () => {
      let counter = 0
      const condition = async () => {
        await sleep(5)
        return ++counter >= 2
      }

      const result = await waitFor(condition, 5000, 10)
      expect(result).toBe(true)
    })
  })
})

describe('String Utilities', () => {
  describe('generateId', () => {
    it('generates random ID with default length', () => {
      const id = generateId()
      expect(id).toHaveLength(8)
      expect(id).toMatch(/^[a-z0-9]+$/)
    })

    it('generates ID with custom length', () => {
      const id = generateId('', 12)
      expect(id).toHaveLength(12)
    })

    it('includes prefix when provided', () => {
      const id = generateId('test', 8)
      expect(id).toMatch(/^test-[a-z0-9]{8}$/)
      expect(id).toHaveLength(13) // 'test' + '-' + 8 chars
    })

    it('generates unique IDs', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('formatBytes', () => {
    it('formats bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(500)).toBe('500 B')
      expect(formatBytes(1023)).toBe('1023 B')
    })

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })

    it('formats megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })

    it('formats gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    })

    it('formats terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
    })
  })

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms')
      expect(formatDuration(999)).toBe('999ms')
    })

    it('formats seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s')
      expect(formatDuration(5500)).toBe('5.5s')
      expect(formatDuration(59999)).toBe('60.0s')
    })

    it('formats minutes', () => {
      expect(formatDuration(60000)).toBe('1m 0s')
      expect(formatDuration(90000)).toBe('1m 30s')
      expect(formatDuration(150000)).toBe('2m 30s')
    })

    it('formats hours', () => {
      expect(formatDuration(3600000)).toBe('1h 0m')
      expect(formatDuration(3660000)).toBe('1h 1m')
      expect(formatDuration(7320000)).toBe('2h 2m')
    })
  })

  describe('truncate', () => {
    it('returns string unchanged if shorter than max length', () => {
      expect(truncate('short', 10)).toBe('short')
    })

    it('truncates long strings', () => {
      expect(truncate('This is a very long string', 10)).toBe('This is...')
    })

    it('uses custom suffix', () => {
      expect(truncate('Long string here', 10, '…')).toBe('Long stri…')
    })

    it('handles exact length match', () => {
      expect(truncate('exactly10c', 10)).toBe('exactly10c')
    })
  })
})

describe('Array Utilities', () => {
  describe('ensureArray', () => {
    it('wraps non-array values in array', () => {
      expect(ensureArray('single')).toEqual(['single'])
      expect(ensureArray(42)).toEqual([42])
      expect(ensureArray(null)).toEqual([null])
    })

    it('returns arrays unchanged', () => {
      const arr = ['a', 'b', 'c']
      expect(ensureArray(arr)).toBe(arr)
    })

    it('preserves empty arrays', () => {
      expect(ensureArray([])).toEqual([])
    })
  })
})

describe('Function Utilities', () => {
  describe('debounce', () => {
    it('debounces function calls', async () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 50)

      debounced()
      debounced()
      debounced()

      expect(fn).not.toHaveBeenCalled()

      await sleep(60)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('resets timer on each call', async () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 50)

      debounced()
      await sleep(30)
      debounced()
      await sleep(30)
      debounced()
      await sleep(30)

      expect(fn).not.toHaveBeenCalled()

      await sleep(30)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('passes arguments correctly', async () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 50)

      debounced('arg1', 'arg2')

      await sleep(60)
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })
})

describe('Environment Utilities', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('requireEnv', () => {
    it('returns environment variable value', () => {
      process.env.TEST_VAR = 'test-value'
      expect(requireEnv('TEST_VAR')).toBe('test-value')
    })

    it('throws error for missing variable', () => {
      process.env.TEST_VAR = undefined
      expect(() => requireEnv('TEST_VAR')).toThrow(
        'Required environment variable TEST_VAR is not set',
      )
    })

    it('uses fallback when primary is missing', () => {
      process.env.PRIMARY = undefined
      process.env.FALLBACK = 'fallback-value'
      expect(requireEnv('PRIMARY', 'FALLBACK')).toBe('fallback-value')
    })

    it('prefers primary over fallback', () => {
      process.env.PRIMARY = 'primary-value'
      process.env.FALLBACK = 'fallback-value'
      expect(requireEnv('PRIMARY', 'FALLBACK')).toBe('primary-value')
    })

    it('throws error when both primary and fallback are missing', () => {
      process.env.PRIMARY = undefined
      process.env.FALLBACK = undefined
      expect(() => requireEnv('PRIMARY', 'FALLBACK')).toThrow(
        'Required environment variable PRIMARY or FALLBACK is not set',
      )
    })
  })

  describe('validateDependencies', () => {
    it('returns true when all dependencies are available', async () => {
      const result = await validateDependencies(['node:fs', 'node:path'])
      expect(result).toBe(true)
    })

    it('returns false when dependencies are missing', async () => {
      const result = await validateDependencies(['nonexistent-package-xyz'])
      expect(result).toBe(false)
    })

    it('logs missing dependencies when log option is true', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await validateDependencies(['nonexistent-package'], { log: true })

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent-package'))

      consoleErrorSpy.mockRestore()
    })

    it('throws error when throwOnMissing is true', async () => {
      await expect(
        validateDependencies(['nonexistent-package'], { throwOnMissing: true }),
      ).rejects.toThrow('Missing dependencies: nonexistent-package')
    })

    it('validates multiple packages', async () => {
      const result = await validateDependencies([
        'node:fs',
        'nonexistent-a',
        'node:path',
        'nonexistent-b',
      ])
      expect(result).toBe(false)
    })
  })
})
