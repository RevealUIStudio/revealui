import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

// Mock validators
vi.mock('../../validators/credentials.js', () => ({
  validateNeonUrl: vi.fn().mockResolvedValue({ valid: true }),
  validateStripeKey: vi.fn().mockResolvedValue({ valid: true }),
  validateSupabaseUrl: vi.fn().mockResolvedValue({ valid: true }),
  validateVercelToken: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock node:fs (for project.ts)
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
  },
}));

import { confirm, select, text } from '@clack/prompts';
import { promptDatabaseConfig } from '../database.js';
import { promptDevEnvConfig } from '../devenv.js';
import { promptPaymentConfig } from '../payments.js';
import { promptProjectConfig } from '../project.js';
import { promptStorageConfig } from '../storage.js';

const mockText = vi.mocked(text);
const mockSelect = vi.mocked(select);
const mockConfirm = vi.mocked(confirm);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('promptDevEnvConfig', () => {
  it('returns config with both options enabled', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    mockConfirm.mockResolvedValueOnce(true);
    const result = await promptDevEnvConfig();
    expect(result).toEqual({
      createDevContainer: true,
      createDevbox: true,
    });
  });

  it('returns config with both options disabled', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    mockConfirm.mockResolvedValueOnce(false);
    const result = await promptDevEnvConfig();
    expect(result).toEqual({
      createDevContainer: false,
      createDevbox: false,
    });
  });

  it('calls confirm twice', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    mockConfirm.mockResolvedValueOnce(false);
    await promptDevEnvConfig();
    expect(mockConfirm).toHaveBeenCalledTimes(2);
  });
});

describe('promptDatabaseConfig', () => {
  it('returns skip config when user chooses skip', async () => {
    mockSelect.mockResolvedValueOnce('skip');
    const result = await promptDatabaseConfig();
    expect(result).toEqual({ provider: 'skip' });
  });

  it('returns local config with connection string', async () => {
    mockSelect.mockResolvedValueOnce('local');
    mockText.mockResolvedValueOnce('postgresql://postgres:postgres@localhost:5432/revealui');
    const result = await promptDatabaseConfig();
    expect(result).toEqual({
      provider: 'local',
      postgresUrl: 'postgresql://postgres:postgres@localhost:5432/revealui',
    });
  });

  it('returns neon config with connection string', async () => {
    mockSelect.mockResolvedValueOnce('neon');
    mockText.mockResolvedValueOnce('postgresql://user:pass@neon.tech/mydb');
    const result = await promptDatabaseConfig();
    expect(result).toEqual({
      provider: 'neon',
      postgresUrl: 'postgresql://user:pass@neon.tech/mydb',
    });
  });

  it('returns supabase config with connection string', async () => {
    mockSelect.mockResolvedValueOnce('supabase');
    mockText.mockResolvedValueOnce('postgresql://user:pass@supabase.co/mydb');
    const result = await promptDatabaseConfig();
    expect(result).toEqual({
      provider: 'supabase',
      postgresUrl: 'postgresql://user:pass@supabase.co/mydb',
    });
  });

  it('calls select once for skip (no follow-up)', async () => {
    mockSelect.mockResolvedValueOnce('skip');
    await promptDatabaseConfig();
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockText).not.toHaveBeenCalled();
  });

  it('calls select + text for non-skip providers', async () => {
    mockSelect.mockResolvedValueOnce('neon');
    mockText.mockResolvedValueOnce('postgresql://x@y/z');
    await promptDatabaseConfig();
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockText).toHaveBeenCalledOnce();
  });
});

describe('promptProjectConfig', () => {
  it('uses defaultName when provided (skips name prompt)', async () => {
    mockSelect.mockResolvedValueOnce('basic-blog');
    const result = await promptProjectConfig('my-project');
    expect(result.projectName).toBe('my-project');
    expect(mockText).not.toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it('prompts for name when defaultName not provided', async () => {
    mockText.mockResolvedValueOnce('prompted-name');
    mockSelect.mockResolvedValueOnce('e-commerce');
    const result = await promptProjectConfig();
    expect(result.projectName).toBe('prompted-name');
    expect(result.template).toBe('e-commerce');
    expect(mockText).toHaveBeenCalledOnce();
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it('uses templateArg when valid (skips template prompt)', async () => {
    const result = await promptProjectConfig('my-project', 'portfolio');
    expect(result.template).toBe('portfolio');
    expect(mockText).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('prompts for template when templateArg is invalid', async () => {
    mockSelect.mockResolvedValueOnce('basic-blog');
    const result = await promptProjectConfig('my-project', 'invalid-template');
    expect(result.template).toBe('basic-blog');
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it('resolves projectPath from cwd and projectName', async () => {
    const result = await promptProjectConfig('test-project', 'basic-blog');
    expect(result.projectPath).toContain('test-project');
  });

  it('returns all three fields in the config', async () => {
    const result = await promptProjectConfig('my-app', 'e-commerce');
    expect(result).toHaveProperty('projectName');
    expect(result).toHaveProperty('projectPath');
    expect(result).toHaveProperty('template');
  });
});

describe('promptPaymentConfig', () => {
  it('returns disabled config when user declines', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const result = await promptPaymentConfig();
    expect(result).toEqual({ enabled: false });
  });

  it('calls confirm once when user declines payments', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    await promptPaymentConfig();
    expect(mockConfirm).toHaveBeenCalledOnce();
    expect(mockText).not.toHaveBeenCalled();
  });

  it('returns full config when user enables payments', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    mockText.mockResolvedValueOnce('sk_test_abc123');
    mockText.mockResolvedValueOnce('pk_test_xyz789');
    mockText.mockResolvedValueOnce('whsec_secret');
    const result = await promptPaymentConfig();
    expect(result).toEqual({
      enabled: true,
      stripeSecretKey: 'sk_test_abc123',
      stripePublishableKey: 'pk_test_xyz789',
      stripeWebhookSecret: 'whsec_secret',
    });
  });

  it('sets webhookSecret to undefined when empty', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    mockText.mockResolvedValueOnce('sk_test_abc123');
    mockText.mockResolvedValueOnce('pk_test_xyz789');
    mockText.mockResolvedValueOnce('');
    const result = await promptPaymentConfig();
    expect(result.stripeWebhookSecret).toBeUndefined();
  });

  it('calls confirm once + text thrice when user enables payments', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    mockText.mockResolvedValueOnce('sk_test_abc');
    mockText.mockResolvedValueOnce('pk_test_abc');
    mockText.mockResolvedValueOnce('');
    await promptPaymentConfig();
    expect(mockConfirm).toHaveBeenCalledOnce();
    expect(mockText).toHaveBeenCalledTimes(3);
  });
});

describe('promptStorageConfig', () => {
  it('returns skip config when user chooses skip', async () => {
    mockSelect.mockResolvedValueOnce('skip');
    const result = await promptStorageConfig();
    expect(result).toEqual({ provider: 'skip' });
  });

  it('calls select once for skip', async () => {
    mockSelect.mockResolvedValueOnce('skip');
    await promptStorageConfig();
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockText).not.toHaveBeenCalled();
  });

  it('returns vercel-blob config with token', async () => {
    mockSelect.mockResolvedValueOnce('vercel-blob');
    mockText.mockResolvedValueOnce('vercel_blob_rw_abc123');
    const result = await promptStorageConfig();
    expect(result).toEqual({
      provider: 'vercel-blob',
      blobToken: 'vercel_blob_rw_abc123',
    });
  });

  it('returns supabase config with url and key', async () => {
    mockSelect.mockResolvedValueOnce('supabase');
    mockText.mockResolvedValueOnce('https://abc.supabase.co');
    mockText.mockResolvedValueOnce('eyJ...');
    const result = await promptStorageConfig();
    expect(result).toEqual({
      provider: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      supabasePublishableKey: 'eyJ...',
    });
  });

  it('calls select + text for vercel-blob', async () => {
    mockSelect.mockResolvedValueOnce('vercel-blob');
    mockText.mockResolvedValueOnce('token');
    await promptStorageConfig();
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockText).toHaveBeenCalledOnce();
  });

  it('calls select + 2 text for supabase', async () => {
    mockSelect.mockResolvedValueOnce('supabase');
    mockText.mockResolvedValueOnce('https://abc.supabase.co');
    mockText.mockResolvedValueOnce('key');
    await promptStorageConfig();
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockText).toHaveBeenCalledTimes(2);
  });
});
