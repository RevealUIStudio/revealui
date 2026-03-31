import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock node:crypto for deterministic env-file tests
vi.mock('node:crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: () => 'a'.repeat(64),
    })),
  },
}));

import fs from 'node:fs/promises';
import type { ProjectConfig } from '../../prompts/project.js';
import { generateDevbox } from '../devbox.js';
import { generateDevContainer } from '../devcontainer.js';
import type { EnvConfig } from '../env-file.js';
import { generateEnvFile } from '../env-file.js';
import { generateReadme } from '../readme.js';

const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateReadme', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    projectPath: '/tmp/my-app',
    template: 'basic-blog',
  };

  it('writes README.md to the project path', async () => {
    await generateReadme('/tmp/my-app', baseConfig);
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(mockWriteFile.mock.calls[0][0]).toBe('/tmp/my-app/README.md');
    expect(mockWriteFile.mock.calls[0][2]).toBe('utf-8');
  });

  it('includes the project name as heading', async () => {
    await generateReadme('/tmp/my-app', baseConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toMatch(/^# my-app/);
  });

  it('includes the template name', async () => {
    await generateReadme('/tmp/my-app', baseConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('**basic-blog** template');
  });

  it('includes getting started instructions', async () => {
    await generateReadme('/tmp/my-app', baseConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('pnpm install');
    expect(content).toContain('pnpm dev');
    expect(content).toContain('pnpm db:init');
  });

  it('includes project structure with project name', async () => {
    await generateReadme('/tmp/my-app', baseConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('my-app/');
    expect(content).toContain('src/');
    expect(content).toContain('revealui.config.ts');
  });

  it('includes available scripts section', async () => {
    await generateReadme('/tmp/my-app', baseConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('Available Scripts');
    expect(content).toContain('pnpm build');
    expect(content).toContain('pnpm test');
    expect(content).toContain('pnpm db:seed');
  });

  it('uses e-commerce template name when configured', async () => {
    const config: ProjectConfig = { ...baseConfig, template: 'e-commerce' };
    await generateReadme('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('**e-commerce** template');
  });

  it('uses portfolio template name when configured', async () => {
    const config: ProjectConfig = { ...baseConfig, template: 'portfolio' };
    await generateReadme('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('**portfolio** template');
  });
});

describe('generateDevbox', () => {
  it('writes devbox.json to the project path', async () => {
    await generateDevbox('/tmp/my-app');
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(mockWriteFile.mock.calls[0][0]).toBe('/tmp/my-app/devbox.json');
    expect(mockWriteFile.mock.calls[0][2]).toBe('utf-8');
  });

  it('generates valid JSON', async () => {
    await generateDevbox('/tmp/my-app');
    const content = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
  });

  it('includes required Node.js package', async () => {
    await generateDevbox('/tmp/my-app');
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(content.packages).toContain('nodejs@24.13.0');
  });

  it('includes pnpm package', async () => {
    await generateDevbox('/tmp/my-app');
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(content.packages).toContain('pnpm@10.28.2');
  });

  it('includes postgresql package', async () => {
    await generateDevbox('/tmp/my-app');
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(content.packages).toContain('postgresql@16');
  });

  it('includes shell scripts', async () => {
    await generateDevbox('/tmp/my-app');
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(content.shell.scripts).toEqual({
      dev: 'pnpm dev',
      setup: 'pnpm install && pnpm db:init',
      test: 'pnpm test',
    });
  });

  it('sets NODE_ENV to development', async () => {
    await generateDevbox('/tmp/my-app');
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(content.env.NODE_ENV).toBe('development');
  });

  it('includes init_hook with corepack enable', async () => {
    await generateDevbox('/tmp/my-app');
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(content.shell.init_hook).toContain('corepack enable');
  });
});

describe('generateDevContainer', () => {
  it('creates the .devcontainer directory', async () => {
    await generateDevContainer('/tmp/my-app');
    expect(mockMkdir).toHaveBeenCalledWith('/tmp/my-app/.devcontainer', {
      recursive: true,
    });
  });

  it('writes devcontainer.json', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'));
    expect(devcontainerCall).toBeDefined();
  });

  it('writes docker-compose.yml', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const composeCall = calls.find((c) => (c[0] as string).endsWith('docker-compose.yml'));
    expect(composeCall).toBeDefined();
  });

  it('writes Dockerfile', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const dockerfileCall = calls.find((c) => (c[0] as string).endsWith('Dockerfile'));
    expect(dockerfileCall).toBeDefined();
  });

  it('writes README.md', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const readmeCall = calls.find((c) => (c[0] as string).endsWith('README.md'));
    expect(readmeCall).toBeDefined();
  });

  it('generates 4 files total', async () => {
    await generateDevContainer('/tmp/my-app');
    expect(mockWriteFile).toHaveBeenCalledTimes(4);
  });

  it('devcontainer.json contains valid JSON with expected fields', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'));
    const config = JSON.parse(devcontainerCall![1] as string);
    expect(config.name).toBe('RevealUI Development');
    expect(config.forwardPorts).toEqual([3000, 4000, 5432]);
    expect(config.remoteUser).toBe('node');
  });

  it('devcontainer.json includes Biome extension', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'));
    const config = JSON.parse(devcontainerCall![1] as string);
    expect(config.customizations.vscode.extensions).toContain('biomejs.biome');
  });

  it('devcontainer.json sets Biome as default formatter', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'));
    const config = JSON.parse(devcontainerCall![1] as string);
    expect(config.customizations.vscode.settings['editor.defaultFormatter']).toBe('biomejs.biome');
  });

  it('docker-compose.yml uses pgvector image', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const composeCall = calls.find((c) => (c[0] as string).endsWith('docker-compose.yml'));
    const content = composeCall![1] as string;
    expect(content).toContain('pgvector/pgvector:pg16');
  });

  it('Dockerfile installs postgresql-client', async () => {
    await generateDevContainer('/tmp/my-app');
    const calls = mockWriteFile.mock.calls;
    const dockerfileCall = calls.find((c) => (c[0] as string).endsWith('Dockerfile'));
    const content = dockerfileCall![1] as string;
    expect(content).toContain('postgresql-client');
    expect(content).toContain('corepack enable');
  });
});

describe('generateEnvFile', () => {
  const baseEnvConfig: EnvConfig = {
    database: { provider: 'neon', postgresUrl: 'postgresql://user:pass@host/db' },
    storage: { provider: 'vercel-blob', blobToken: 'FAKE_BLOB_TOKEN_FOR_TESTS' },
    payment: {
      enabled: true,
      stripeSecretKey: 'FAKE_STRIPE_SK_FOR_TESTS',
      stripePublishableKey: 'FAKE_STRIPE_PK_FOR_TESTS',
      stripeWebhookSecret: 'FAKE_STRIPE_WHSEC_FOR_TESTS',
    },
  };

  it('writes .env.development.local to project path', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(mockWriteFile.mock.calls[0][0]).toBe('/tmp/my-app/.env.development.local');
    expect(mockWriteFile.mock.calls[0][2]).toBe('utf-8');
  });

  it('includes REVEALUI_SECRET generated from crypto', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain(`REVEALUI_SECRET=${'a'.repeat(64)}`);
  });

  it('includes core server URLs', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000');
    expect(content).toContain('NEXT_PUBLIC_SERVER_URL=http://localhost:4000');
  });

  it('includes POSTGRES_URL when database is configured', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('POSTGRES_URL=postgresql://user:pass@host/db');
  });

  it('comments out POSTGRES_URL when database is skipped', async () => {
    const config: EnvConfig = {
      ...baseEnvConfig,
      database: { provider: 'skip' },
    };
    await generateEnvFile('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('# POSTGRES_URL=');
    expect(content).not.toMatch(/^POSTGRES_URL=/m);
  });

  it('includes Vercel Blob token when storage is vercel-blob', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('BLOB_READ_WRITE_TOKEN=FAKE_BLOB_TOKEN_FOR_TESTS');
  });

  it('includes Supabase keys when storage is supabase', async () => {
    const config: EnvConfig = {
      ...baseEnvConfig,
      storage: {
        provider: 'supabase',
        supabaseUrl: 'https://abc.supabase.co',
        supabasePublishableKey: 'sb_publishable_test',
      },
    };
    await generateEnvFile('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test');
  });

  it('comments out storage when provider is not configured', async () => {
    const config: EnvConfig = {
      ...baseEnvConfig,
      storage: { provider: 'skip' },
    };
    await generateEnvFile('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('# BLOB_READ_WRITE_TOKEN=');
  });

  it('includes all Stripe keys when payments are enabled', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('STRIPE_SECRET_KEY=FAKE_STRIPE_SK_FOR_TESTS');
    expect(content).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=FAKE_STRIPE_PK_FOR_TESTS');
    expect(content).toContain('STRIPE_WEBHOOK_SECRET=FAKE_STRIPE_WHSEC_FOR_TESTS');
  });

  it('comments out Stripe keys when payments are disabled', async () => {
    const config: EnvConfig = {
      ...baseEnvConfig,
      payment: { enabled: false },
    };
    await generateEnvFile('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('# STRIPE_SECRET_KEY=');
    expect(content).toContain('# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=');
    expect(content).toContain('# STRIPE_WEBHOOK_SECRET=');
  });

  it('comments out webhook secret with CLI instructions when not provided', async () => {
    const config: EnvConfig = {
      ...baseEnvConfig,
      payment: {
        enabled: true,
        stripeSecretKey: 'FAKE_STRIPE_SK_FOR_TESTS',
        stripePublishableKey: 'FAKE_STRIPE_PK_FOR_TESTS',
      },
    };
    await generateEnvFile('/tmp/my-app', config);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('STRIPE_SECRET_KEY=FAKE_STRIPE_SK_FOR_TESTS');
    expect(content).toContain('# STRIPE_WEBHOOK_SECRET=');
    expect(content).toContain('stripe listen --forward-to');
  });

  it('includes CORS origins', async () => {
    await generateEnvFile('/tmp/my-app', baseEnvConfig);
    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toContain('REVEALUI_CORS_ORIGINS=http://localhost:3000,http://localhost:4000');
  });
});
