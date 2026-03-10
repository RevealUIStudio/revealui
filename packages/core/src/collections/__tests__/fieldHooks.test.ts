import { describe, expect, it, vi } from 'vitest'
import type { RevealCollectionConfig } from '../../types/index.js'
import { runBeforeFieldHooks } from '../operations/fieldHooks.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createConfig(fields: unknown[]): RevealCollectionConfig {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  return { slug: 'test', fields } as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runBeforeFieldHooks', () => {
  describe('beforeValidate hooks', () => {
    it('does nothing when no fields have hooks', async () => {
      const config = createConfig([
        { name: 'title', type: 'text' },
        { name: 'status', type: 'select' },
      ])
      const data = { title: 'Hello', status: 'draft' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data).toEqual({ title: 'Hello', status: 'draft' })
    })

    it('runs a single beforeValidate hook', async () => {
      const hook = vi.fn().mockReturnValue('UPPERCASE')
      const config = createConfig([
        { name: 'title', type: 'text', hooks: { beforeValidate: [hook] } },
      ])
      const data: Record<string, unknown> = { title: 'hello' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.title).toBe('UPPERCASE')
      expect(hook).toHaveBeenCalledOnce()
    })

    it('passes correct arguments to hook', async () => {
      const hook = vi.fn().mockReturnValue('result')
      const config = createConfig([
        { name: 'title', type: 'text', hooks: { beforeValidate: [hook] } },
      ])
      const data: Record<string, unknown> = { title: 'hello' }
      const originalDoc = { id: '1', title: 'old' }

      await runBeforeFieldHooks(config, data, 'update', 'beforeValidate', originalDoc as never)

      const args = hook.mock.calls[0]![0]
      expect(args.value).toBe('hello')
      expect(args.data).toBe(data)
      expect(args.siblingData).toBe(data)
      expect(args.operation).toBe('update')
      expect(args.originalDoc).toBe(originalDoc)
    })

    it('chains multiple hooks on the same field', async () => {
      const hook1 = vi.fn().mockReturnValue('step1')
      const hook2 = vi.fn().mockReturnValue('step2')
      const config = createConfig([
        { name: 'title', type: 'text', hooks: { beforeValidate: [hook1, hook2] } },
      ])
      const data: Record<string, unknown> = { title: 'original' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.title).toBe('step2')
      // hook2 receives the value returned by hook1
      expect(hook2.mock.calls[0]![0].value).toBe('step1')
    })

    it('processes multiple fields independently', async () => {
      const titleHook = vi.fn().mockReturnValue('TITLE')
      const slugHook = vi.fn().mockReturnValue('the-slug')
      const config = createConfig([
        { name: 'title', type: 'text', hooks: { beforeValidate: [titleHook] } },
        { name: 'slug', type: 'text', hooks: { beforeValidate: [slugHook] } },
      ])
      const data: Record<string, unknown> = { title: 'hello', slug: '' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.title).toBe('TITLE')
      expect(data.slug).toBe('the-slug')
    })
  })

  describe('beforeChange hooks', () => {
    it('runs beforeChange hooks', async () => {
      const hook = vi.fn().mockReturnValue('hashed-password')
      const config = createConfig([
        { name: 'password', type: 'text', hooks: { beforeChange: [hook] } },
      ])
      const data: Record<string, unknown> = { password: 'plaintext' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeChange')

      expect(data.password).toBe('hashed-password')
    })

    it('does not run beforeValidate hooks when hookType is beforeChange', async () => {
      const validateHook = vi.fn().mockReturnValue('validated')
      const changeHook = vi.fn().mockReturnValue('changed')
      const config = createConfig([
        {
          name: 'field',
          type: 'text',
          hooks: {
            beforeValidate: [validateHook],
            beforeChange: [changeHook],
          },
        },
      ])
      const data: Record<string, unknown> = { field: 'value' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeChange')

      expect(validateHook).not.toHaveBeenCalled()
      expect(changeHook).toHaveBeenCalledOnce()
      expect(data.field).toBe('changed')
    })
  })

  describe('edge cases', () => {
    it('skips fields without a name', async () => {
      const hook = vi.fn()
      const config = createConfig([{ type: 'row', hooks: { beforeValidate: [hook] } }])
      const data: Record<string, unknown> = {}

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(hook).not.toHaveBeenCalled()
    })

    it('skips fields with empty hooks array', async () => {
      const config = createConfig([{ name: 'title', type: 'text', hooks: { beforeValidate: [] } }])
      const data: Record<string, unknown> = { title: 'hello' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.title).toBe('hello')
    })

    it('does not write back undefined hook results for missing fields', async () => {
      const hook = vi.fn().mockReturnValue(undefined)
      const config = createConfig([
        { name: 'optional', type: 'text', hooks: { beforeValidate: [hook] } },
      ])
      const data: Record<string, unknown> = {}

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data).not.toHaveProperty('optional')
    })

    it('writes back defined hook results for previously missing fields', async () => {
      const hook = vi.fn().mockReturnValue('generated-value')
      const config = createConfig([
        { name: 'slug', type: 'text', hooks: { beforeValidate: [hook] } },
      ])
      const data: Record<string, unknown> = {}

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.slug).toBe('generated-value')
    })

    it('handles async hooks', async () => {
      const hook = vi.fn().mockImplementation(async ({ value }: { value: unknown }) => {
        await new Promise((r) => setTimeout(r, 1))
        return `${value}-processed`
      })
      const config = createConfig([
        { name: 'title', type: 'text', hooks: { beforeValidate: [hook] } },
      ])
      const data: Record<string, unknown> = { title: 'hello' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.title).toBe('hello-processed')
    })

    it('flattens tab and row fields', async () => {
      const hook = vi.fn().mockReturnValue('modified')
      const config = createConfig([
        {
          type: 'tabs',
          tabs: [
            {
              fields: [{ name: 'nested', type: 'text', hooks: { beforeValidate: [hook] } }],
            },
          ],
        },
      ])
      const data: Record<string, unknown> = { nested: 'original' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.nested).toBe('modified')
    })

    it('flattens row fields', async () => {
      const hook = vi.fn().mockReturnValue('modified')
      const config = createConfig([
        {
          type: 'row',
          fields: [{ name: 'inRow', type: 'text', hooks: { beforeValidate: [hook] } }],
        },
      ])
      const data: Record<string, unknown> = { inRow: 'original' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.inRow).toBe('modified')
    })

    it('handles empty fields config', async () => {
      const config = createConfig([])
      const data: Record<string, unknown> = { title: 'hello' }

      await runBeforeFieldHooks(config, data, 'create', 'beforeValidate')

      expect(data.title).toBe('hello')
    })
  })
})
