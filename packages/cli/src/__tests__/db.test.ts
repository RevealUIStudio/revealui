import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  debug: vi.fn(),
  header: vi.fn(),
  divider: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('@revealui/setup/utils', () => ({
  createLogger: () => mockLogger,
}));

import { execa } from 'execa';
import { runDbStatusCommand } from '../commands/db.js';

const mockExeca = vi.mocked(execa);

describe('runDbStatusCommand', () => {
  let tempRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'revealui-db-test-'));
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: 'revealui', private: true }),
      'utf8',
    );
    process.chdir(tempRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('warns instead of throwing when postgres is not running', async () => {
    mockExeca.mockImplementation(async (command, args) => {
      if (command === 'bash') {
        return {} as Awaited<ReturnType<typeof execa>>;
      }
      if (command === 'pg_ctl' && args?.[0] === 'status') {
        throw Object.assign(new Error('pg_ctl: no server running'), { exitCode: 3 });
      }
      throw new Error(`unexpected command: ${command} ${args?.join(' ')}`);
    });

    await expect(runDbStatusCommand()).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('PostgreSQL is not running'),
    );
  });
});
