import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScriptsCLI } from '../../../scripts/cli/scripts.js';
import { ErrorCode } from '../errors.js';

const owners = vi.hoisted(() => ({
  search: vi.fn(),
  getScript: vi.fn(),
  exec: vi.fn(),
  logger: { startExecution: vi.fn(), endExecution: vi.fn(), close: vi.fn(), getHistory: vi.fn() },
}));
vi.mock('../registry/script-registry.js', () => ({
  createScriptRegistry: () => ({ search: owners.search, getScript: owners.getScript }),
}));
vi.mock('../exec.js', () => ({ execCommand: owners.exec }));
vi.mock('../audit/execution-logger.js', () => ({
  acquireExecutionLogger: async () => ({
    logger: owners.logger,
    release: () => owners.logger.close(),
  }),
}));

describe('Actual script explorer shared execution contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    owners.search.mockResolvedValue([]);
    owners.getScript.mockResolvedValue({ name: 'fixture', commands: ['delete'] });
    owners.exec.mockResolvedValue({ success: false, exitCode: 23, message: 'child failed' });
    owners.logger.startExecution.mockResolvedValue('scripts-execution');
    owners.logger.endExecution.mockResolvedValue(undefined);
    owners.logger.close.mockResolvedValue(undefined);
    owners.logger.getHistory.mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['--supports-dry-run', '-d'])(
    'retains dry-run support filtering via %s',
    async (flag) => {
      await new ScriptsCLI({ argv: ['list', flag], exitOnComplete: false }).run();
      expect(owners.search).toHaveBeenCalledWith({ supportsDryRun: true });
    },
  );

  it('makes the old --dry-run filter a universal plan without registry or audit mutation', async () => {
    expect(
      await new ScriptsCLI({ argv: ['list', '--dry-run'], exitOnComplete: false }).run(),
    ).toMatchObject({ status: 'simulated' });
    expect(owners.search).not.toHaveBeenCalled();
    expect(owners.logger.startExecution).not.toHaveBeenCalled();
  });

  it('preserves history -f failed filtering and long --force independently', async () => {
    await new ScriptsCLI({ argv: ['history', '-f', '--force'], exitOnComplete: false }).run();
    expect(owners.logger.getHistory).toHaveBeenCalledWith({
      scriptName: undefined,
      failedOnly: true,
      limit: 20,
    });
  });

  it('propagates child failure via the shared lifecycle without manual markers', async () => {
    const result = await new ScriptsCLI({
      argv: ['run', 'fixture', 'delete'],
      exitOnComplete: false,
    }).run();
    expect(result).toMatchObject({ status: 'failed', exitCode: ErrorCode.EXECUTION_ERROR });
    expect(owners.exec).toHaveBeenCalledOnce();
    expect(owners.logger.endExecution).toHaveBeenCalledWith(
      'scripts-execution',
      expect.objectContaining({
        success: false,
        exitCode: ErrorCode.EXECUTION_ERROR,
        error: 'child failed',
      }),
    );
  });

  it('guards script execution when --dry-run precedes the command', async () => {
    const result = await new ScriptsCLI({
      argv: ['--dry-run', 'run', 'fixture', 'delete'],
      exitOnComplete: false,
    }).run();
    expect(result.status).toBe('simulated');
    expect(owners.getScript).not.toHaveBeenCalled();
    expect(owners.exec).not.toHaveBeenCalled();
  });
});
