import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseCLI } from '../../../scripts/cli/release.js';
import { ErrorCode } from '../errors.js';

const effects = vi.hoisted(() => ({
  exec: vi.fn(),
  logger: { startExecution: vi.fn(), endExecution: vi.fn(), close: vi.fn() },
}));
vi.mock('../index.js', () => ({ execCommand: effects.exec }));
vi.mock('../exec.js', () => ({ execCommand: effects.exec }));
vi.mock('../audit/execution-logger.js', () => ({
  acquireExecutionLogger: async () => ({
    logger: effects.logger,
    release: () => effects.logger.close(),
  }),
}));

describe('Actual release CLI canonical publication boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effects.exec.mockResolvedValue({ success: true, exitCode: 0, stdout: '', message: 'fixture' });
    effects.logger.startExecution.mockResolvedValue('release-execution');
    effects.logger.endExecution.mockResolvedValue(undefined);
    effects.logger.close.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('refuses malformed simulation flags before version mutation or audit setup', async () => {
    const result = await new ReleaseCLI({
      argv: ['version', '--dry-run=typo', '--force'],
      exitOnComplete: false,
    }).run();
    expect(result).toMatchObject({ status: 'failed', exitCode: ErrorCode.VALIDATION_ERROR });
    expect(effects.exec).not.toHaveBeenCalled();
    expect(effects.logger.startExecution).not.toHaveBeenCalled();
  });

  it.each([
    ['oss'],
    ['pro'],
    ['publish'],
    ['tag', '--version', 'v1.2.3'],
    ['version', '--type', 'minor'],
    ['status'],
    ['preview'],
    ['dry-run'],
  ])('simulates %j without executors or audit mutation', async (...command) => {
    const cli = new ReleaseCLI({
      argv: [...command, '--dry-run', '--force'],
      exitOnComplete: false,
    });
    await cli.run();
    expect(effects.exec).not.toHaveBeenCalled();
    expect(effects.logger.startExecution).not.toHaveBeenCalled();
  });

  it.each(['oss', 'pro', 'publish', 'tag'])(
    'refuses local %s execution with nonzero audit outcome',
    async (command) => {
      const cli = new ReleaseCLI({
        argv: [command, '--version', 'v1.2.3', '--force'],
        exitOnComplete: false,
      });
      await cli.run();
      expect(effects.exec).not.toHaveBeenCalled();
      expect(effects.logger.endExecution).toHaveBeenCalledWith(
        'release-execution',
        expect.objectContaining({ success: false }),
      );
    },
  );

  it('keeps every root release simulation alias within the same safe parser', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };
    for (const [alias, command] of Object.entries(manifest.scripts)) {
      if (!alias.startsWith('release:')) continue;
      const parts = command.split(' ');
      if (parts[1] !== 'scripts/cli/release.ts') continue;
      expect(parts[0]).toBe('tsx');
      const cli = new ReleaseCLI({
        argv: [...parts.slice(2), '--dry-run', '--force'],
        exitOnComplete: false,
      });
      await cli.run();
    }
    expect(effects.exec).not.toHaveBeenCalled();
  });

  it.each(['status', 'preview'])(
    'preserves supported %s execution and failure propagation',
    async (command) => {
      effects.exec.mockResolvedValue({
        success: false,
        exitCode: 3,
        message: 'status unavailable',
      });
      await new ReleaseCLI({ argv: [command, '--force'], exitOnComplete: false }).run();
      expect(effects.exec).toHaveBeenCalledOnce();
      expect(effects.logger.endExecution).toHaveBeenCalledWith(
        'release-execution',
        expect.objectContaining({ success: false }),
      );
    },
  );
});
