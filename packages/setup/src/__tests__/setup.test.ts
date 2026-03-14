import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';
import { setupEnvironment } from '../environment/setup.js';

const mockPrompt = vi.mocked(inquirer.prompt);

interface PromptQuestion {
  validate?: (input: string) => boolean | string;
}

describe('setupEnvironment', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'setup-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const silentLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    header: vi.fn(),
    divider: vi.fn(),
    table: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
    progress: vi.fn(),
  };

  it('fails when template file does not exist', async () => {
    const result = await setupEnvironment({
      projectRoot: tempDir,
      interactive: false,
      logger: silentLogger,
    });
    expect(result.success).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('copies template to output path', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'KEY=value\n');

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      generateOnly: true,
      logger: silentLogger,
    });

    expect(result.success).toBe(true);
    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('KEY');
  });

  it('does not overwrite existing file in non-interactive mode without force', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'KEY=value\n');
    await writeFile(outputPath, 'EXISTING=yes\n');

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      force: false,
      logger: silentLogger,
    });

    expect(result.success).toBe(false);
    const content = await readFile(outputPath, 'utf-8');
    expect(content).toBe('EXISTING=yes\n');
  });

  it('overwrites existing file when force is true', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'NEW_KEY=new\n');
    await writeFile(outputPath, 'OLD_KEY=old\n');

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      force: true,
      generateOnly: true,
      logger: silentLogger,
    });

    expect(result.success).toBe(true);
    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('NEW_KEY');
  });

  it('generates secrets in generateOnly mode', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'REVEALUI_SECRET=placeholder\n');

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      generateOnly: true,
      logger: silentLogger,
    });

    expect(result.success).toBe(true);
    const content = await readFile(outputPath, 'utf-8');
    expect(content).not.toContain('placeholder');
  });

  it('uses custom variables when provided', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'MY_VAR=\n');

    const customVars = [{ name: 'MY_VAR', description: 'A custom var', required: true }];

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      customVariables: customVars,
      logger: silentLogger,
    });

    expect(result.missing).toContain('MY_VAR');
  });

  it('prompts for overwrite in interactive mode when file exists', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'KEY=value\n');
    await writeFile(outputPath, 'EXISTING=yes\n');

    mockPrompt.mockResolvedValueOnce({ overwrite: false });

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: true,
      logger: silentLogger,
    });

    expect(result.success).toBe(false);
    expect(mockPrompt).toHaveBeenCalled();
  });

  it('overwrites existing file in interactive mode when confirmed', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'KEY=value\n');
    await writeFile(outputPath, 'EXISTING=yes\n');

    mockPrompt.mockResolvedValueOnce({ overwrite: true });

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: true,
      customVariables: [{ name: 'KEY', description: 'Configured key', required: true }],
      logger: silentLogger,
    });

    expect(result.success).toBe(true);
    const content = await readFile(outputPath, 'utf-8');
    expect(content).toBe('KEY=value\n');
  });

  it('prompts for missing values and generates REVEALUI_SECRET in interactive mode', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'REVEALUI_SECRET=\nAPP_URL=\n');

    mockPrompt.mockResolvedValueOnce({ value: 'https://example.com' });

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: true,
      customVariables: [
        {
          name: 'REVEALUI_SECRET',
          description: 'Secret key',
          required: true,
          validator: (value) => value.length >= 32,
        },
        {
          name: 'APP_URL',
          description: 'Application URL',
          required: true,
          validator: (value) => value.startsWith('https://'),
        },
      ],
      logger: silentLogger,
    });

    expect(result.success).toBe(true);

    const content = await readFile(outputPath, 'utf-8');
    const secretLine = content.split('\n').find((line) => line.startsWith('REVEALUI_SECRET='));

    expect(secretLine).toBeDefined();
    expect(secretLine).not.toBe('REVEALUI_SECRET=');
    expect(secretLine?.split('=')[1]).toHaveLength(64);
    expect(content).toContain('APP_URL=https://example.com');
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('validates prompted values for missing variables', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'APP_URL=\n');

    mockPrompt.mockResolvedValueOnce({ value: 'https://example.com' });

    await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: true,
      customVariables: [
        {
          name: 'APP_URL',
          description: 'Application URL',
          required: true,
          validator: (value) => value.startsWith('https://'),
        },
      ],
      logger: silentLogger,
    });

    const promptArg = mockPrompt.mock.calls[0]?.[0];
    const questions = Array.isArray(promptArg) ? (promptArg as PromptQuestion[]) : undefined;
    const validate = questions?.[0]?.validate;

    expect(validate).toBeTypeOf('function');
    expect(validate?.('')).toBe('Value cannot be empty (press Ctrl+C to skip)');
    expect(validate?.('http://example.com')).toBe('Invalid format for APP_URL');
    expect(validate?.('https://example.com')).toBe(true);
  });

  it('generates REVEALUI_SECRET in non-interactive mode before final validation', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'REVEALUI_SECRET=\nAPP_URL=\n');

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      customVariables: [
        {
          name: 'REVEALUI_SECRET',
          description: 'Secret key',
          required: true,
          validator: (value) => value.length >= 32,
        },
        {
          name: 'APP_URL',
          description: 'Application URL',
          required: true,
          validator: (value) => value.startsWith('https://'),
        },
      ],
      logger: silentLogger,
    });

    expect(result.success).toBe(false);
    expect(result.missing).toEqual(['APP_URL']);

    const content = await readFile(outputPath, 'utf-8');
    const secretLine = content.split('\n').find((line) => line.startsWith('REVEALUI_SECRET='));

    expect(secretLine).toBeDefined();
    expect(secretLine).not.toBe('REVEALUI_SECRET=');
    expect(secretLine?.split('=')[1]).toHaveLength(64);
  });

  it('reports invalid values after final validation', async () => {
    const templatePath = join(tempDir, '.env.template');
    const outputPath = join(tempDir, '.env.development.local');
    await writeFile(templatePath, 'APP_URL=http://invalid.example.com\n');

    const result = await setupEnvironment({
      projectRoot: tempDir,
      templatePath,
      outputPath,
      interactive: false,
      customVariables: [
        {
          name: 'APP_URL',
          description: 'Application URL',
          required: true,
          validator: (value) => value.startsWith('https://'),
        },
      ],
      logger: silentLogger,
    });

    expect(result.success).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual(['APP_URL']);
  });
});
