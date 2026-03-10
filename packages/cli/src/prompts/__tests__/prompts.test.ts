import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

// Mock validators
vi.mock('../../validators/credentials.js', () => ({
  validateNeonUrl: vi.fn().mockResolvedValue({ valid: true }),
  validateStripeKey: vi.fn().mockResolvedValue({ valid: true }),
  validateSupabaseUrl: vi.fn().mockResolvedValue({ valid: true }),
  validateVercelToken: vi.fn().mockResolvedValue({ valid: true }),
}))

// Mock node:fs (for project.ts)
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
  },
}))

import inquirer from 'inquirer'
import { promptDatabaseConfig } from '../database.js'
import { promptDevEnvConfig } from '../devenv.js'
import { promptPaymentConfig } from '../payments.js'
import { promptProjectConfig } from '../project.js'
import { promptStorageConfig } from '../storage.js'

const mockPrompt = vi.mocked(inquirer.prompt)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('promptDevEnvConfig', () => {
  it('returns config with both options enabled', async () => {
    mockPrompt.mockResolvedValueOnce({
      createDevContainer: true,
      createDevbox: true,
    })
    const result = await promptDevEnvConfig()
    expect(result).toEqual({
      createDevContainer: true,
      createDevbox: true,
    })
  })

  it('returns config with both options disabled', async () => {
    mockPrompt.mockResolvedValueOnce({
      createDevContainer: false,
      createDevbox: false,
    })
    const result = await promptDevEnvConfig()
    expect(result).toEqual({
      createDevContainer: false,
      createDevbox: false,
    })
  })

  it('calls inquirer.prompt once', async () => {
    mockPrompt.mockResolvedValueOnce({
      createDevContainer: true,
      createDevbox: false,
    })
    await promptDevEnvConfig()
    expect(mockPrompt).toHaveBeenCalledOnce()
  })
})

describe('promptDatabaseConfig', () => {
  it('returns skip config when user chooses skip', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'skip' })
    const result = await promptDatabaseConfig()
    expect(result).toEqual({ provider: 'skip' })
  })

  it('returns local config with connection string', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'local' })
    mockPrompt.mockResolvedValueOnce({
      postgresUrl: 'postgresql://postgres:postgres@localhost:5432/revealui',
    })
    const result = await promptDatabaseConfig()
    expect(result).toEqual({
      provider: 'local',
      postgresUrl: 'postgresql://postgres:postgres@localhost:5432/revealui',
    })
  })

  it('returns neon config with connection string', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'neon' })
    mockPrompt.mockResolvedValueOnce({
      postgresUrl: 'postgresql://user:pass@neon.tech/mydb',
    })
    const result = await promptDatabaseConfig()
    expect(result).toEqual({
      provider: 'neon',
      postgresUrl: 'postgresql://user:pass@neon.tech/mydb',
    })
  })

  it('returns supabase config with connection string', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'supabase' })
    mockPrompt.mockResolvedValueOnce({
      postgresUrl: 'postgresql://user:pass@supabase.co/mydb',
    })
    const result = await promptDatabaseConfig()
    expect(result).toEqual({
      provider: 'supabase',
      postgresUrl: 'postgresql://user:pass@supabase.co/mydb',
    })
  })

  it('prompts once for skip (no follow-up)', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'skip' })
    await promptDatabaseConfig()
    expect(mockPrompt).toHaveBeenCalledOnce()
  })

  it('prompts twice for non-skip providers', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'neon' })
    mockPrompt.mockResolvedValueOnce({ postgresUrl: 'postgresql://x@y/z' })
    await promptDatabaseConfig()
    expect(mockPrompt).toHaveBeenCalledTimes(2)
  })
})

describe('promptProjectConfig', () => {
  it('uses defaultName when provided (skips name prompt)', async () => {
    // Only template prompt needed
    mockPrompt.mockResolvedValueOnce({ template: 'basic-blog' })
    const result = await promptProjectConfig('my-project')
    expect(result.projectName).toBe('my-project')
    expect(mockPrompt).toHaveBeenCalledOnce()
  })

  it('prompts for name when defaultName not provided', async () => {
    mockPrompt.mockResolvedValueOnce({ projectName: 'prompted-name' })
    mockPrompt.mockResolvedValueOnce({ template: 'e-commerce' })
    const result = await promptProjectConfig()
    expect(result.projectName).toBe('prompted-name')
    expect(result.template).toBe('e-commerce')
    expect(mockPrompt).toHaveBeenCalledTimes(2)
  })

  it('uses templateArg when valid (skips template prompt)', async () => {
    const result = await promptProjectConfig('my-project', 'portfolio')
    expect(result.template).toBe('portfolio')
    // No prompts needed when both args are provided
    expect(mockPrompt).not.toHaveBeenCalled()
  })

  it('prompts for template when templateArg is invalid', async () => {
    mockPrompt.mockResolvedValueOnce({ template: 'basic-blog' })
    const result = await promptProjectConfig('my-project', 'invalid-template')
    expect(result.template).toBe('basic-blog')
    expect(mockPrompt).toHaveBeenCalledOnce()
  })

  it('resolves projectPath from cwd and projectName', async () => {
    const result = await promptProjectConfig('test-project', 'basic-blog')
    expect(result.projectPath).toContain('test-project')
  })

  it('returns all three fields in the config', async () => {
    const result = await promptProjectConfig('my-app', 'e-commerce')
    expect(result).toHaveProperty('projectName')
    expect(result).toHaveProperty('projectPath')
    expect(result).toHaveProperty('template')
  })
})

describe('promptPaymentConfig', () => {
  it('returns disabled config when user declines', async () => {
    mockPrompt.mockResolvedValueOnce({ enabled: false })
    const result = await promptPaymentConfig()
    expect(result).toEqual({ enabled: false })
  })

  it('prompts once when user declines payments', async () => {
    mockPrompt.mockResolvedValueOnce({ enabled: false })
    await promptPaymentConfig()
    expect(mockPrompt).toHaveBeenCalledOnce()
  })

  it('returns full config when user enables payments', async () => {
    mockPrompt.mockResolvedValueOnce({ enabled: true })
    mockPrompt.mockResolvedValueOnce({
      stripeSecretKey: 'sk_test_abc123',
      stripePublishableKey: 'pk_test_xyz789',
      stripeWebhookSecret: 'whsec_secret',
    })
    const result = await promptPaymentConfig()
    expect(result).toEqual({
      enabled: true,
      stripeSecretKey: 'sk_test_abc123',
      stripePublishableKey: 'pk_test_xyz789',
      stripeWebhookSecret: 'whsec_secret',
    })
  })

  it('sets webhookSecret to undefined when empty', async () => {
    mockPrompt.mockResolvedValueOnce({ enabled: true })
    mockPrompt.mockResolvedValueOnce({
      stripeSecretKey: 'sk_test_abc123',
      stripePublishableKey: 'pk_test_xyz789',
      stripeWebhookSecret: '',
    })
    const result = await promptPaymentConfig()
    expect(result.stripeWebhookSecret).toBeUndefined()
  })

  it('prompts twice when user enables payments', async () => {
    mockPrompt.mockResolvedValueOnce({ enabled: true })
    mockPrompt.mockResolvedValueOnce({
      stripeSecretKey: 'sk_test_abc',
      stripePublishableKey: 'pk_test_abc',
      stripeWebhookSecret: '',
    })
    await promptPaymentConfig()
    expect(mockPrompt).toHaveBeenCalledTimes(2)
  })
})

describe('promptStorageConfig', () => {
  it('returns skip config when user chooses skip', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'skip' })
    const result = await promptStorageConfig()
    expect(result).toEqual({ provider: 'skip' })
  })

  it('prompts once for skip', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'skip' })
    await promptStorageConfig()
    expect(mockPrompt).toHaveBeenCalledOnce()
  })

  it('returns vercel-blob config with token', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'vercel-blob' })
    mockPrompt.mockResolvedValueOnce({ blobToken: 'vercel_blob_rw_abc123' })
    const result = await promptStorageConfig()
    expect(result).toEqual({
      provider: 'vercel-blob',
      blobToken: 'vercel_blob_rw_abc123',
    })
  })

  it('returns supabase config with url and key', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'supabase' })
    mockPrompt.mockResolvedValueOnce({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'eyJ...',
    })
    const result = await promptStorageConfig()
    expect(result).toEqual({
      provider: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'eyJ...',
    })
  })

  it('prompts twice for vercel-blob', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'vercel-blob' })
    mockPrompt.mockResolvedValueOnce({ blobToken: 'token' })
    await promptStorageConfig()
    expect(mockPrompt).toHaveBeenCalledTimes(2)
  })

  it('prompts twice for supabase', async () => {
    mockPrompt.mockResolvedValueOnce({ provider: 'supabase' })
    mockPrompt.mockResolvedValueOnce({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'key',
    })
    await promptStorageConfig()
    expect(mockPrompt).toHaveBeenCalledTimes(2)
  })
})
