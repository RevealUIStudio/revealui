import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CommandDefinition, ExecutingCLI } from '../../../scripts/cli/_base.js';
import { ErrorCode, ScriptError } from '../errors.js';
import { fail, ok } from '../output.js';

const audit = vi.hoisted(() => ({
  startExecution: vi.fn(),
  endExecution: vi.fn(),
  close: vi.fn(),
  getExecutionLogger: vi.fn(),
}));
vi.mock('../audit/execution-logger.js', () => ({
  acquireExecutionLogger: async () => ({
    logger: await audit.getExecutionLogger(),
    release: () => audit.close(),
  }),
}));
vi.mock('@revealui/core/monitoring/process-registry', () => ({
  registerProcess: vi.fn(),
  updateProcessStatus: vi.fn(),
}));

class FixtureCLI extends ExecutingCLI {
  name = 'fixture';
  description = 'Actual shared lifecycle fixture';
  protected enableExecutionLogging = true;
  effect = vi.fn();
  initializationError?: Error;
  cleanupError?: Error;
  handlerError?: Error;
  unsuccessful = false;
  failureCode = 'EXECUTION_ERROR';
  waiting?: Promise<void>;
  confirmed = true;

  defineGlobalArgs() {
    return [{ name: 'custom', type: 'boolean' as const, description: 'Subclass flag' }];
  }

  defineCommands(): CommandDefinition[] {
    return ['delete', 'alias', 'plan'].map((name) => ({
      name,
      description: 'Effectful command',
      executionMode: name === 'plan' ? 'simulate' : undefined,
      args: [
        {
          name: 'dry-run',
          type: 'boolean',
          default: false,
          description: 'Conflicting command default',
        },
      ],
      confirmPrompt: 'Confirm deletion',
      handler: async () => {
        this.effect();
        await this.waiting;
        if (this.handlerError) throw this.handlerError;
        return this.unsuccessful ? fail(this.failureCode, 'handler refused') : ok({ done: true });
      },
    }));
  }

  async confirm() {
    return this.confirmed;
  }

  async beforeRun() {
    await super.beforeRun();
    if (this.initializationError) throw this.initializationError;
  }

  async afterRun() {
    await super.afterRun();
    if (this.cleanupError) throw this.cleanupError;
  }
}

describe('Shared CLI execution contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audit.startExecution.mockResolvedValue('execution-id');
    audit.endExecution.mockResolvedValue(undefined);
    audit.close.mockResolvedValue(undefined);
    audit.getExecutionLogger.mockResolvedValue(audit);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['delete', 'alias'])(
    'simulates %s without hooks, opaque handler, or audit writes',
    async (name) => {
      const cli = new FixtureCLI({ argv: [name, '--dry-run', '--force'], exitOnComplete: false });
      const before = vi.spyOn(cli, 'beforeRun');
      const after = vi.spyOn(cli, 'afterRun');
      const confirmation = vi.spyOn(cli, 'confirm');
      await cli.run();
      expect(cli.effect).not.toHaveBeenCalled();
      expect(before).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
      expect(confirmation).not.toHaveBeenCalled();
      expect(audit.getExecutionLogger).not.toHaveBeenCalled();
    },
  );

  it.each(['handler', 'initialization', 'cleanup'])('records %s throw as failed', async (phase) => {
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    const error = new ScriptError(`${phase} failed`, ErrorCode.EXECUTION_ERROR);
    if (phase === 'handler') cli.handlerError = error;
    if (phase === 'initialization') cli.initializationError = error;
    if (phase === 'cleanup') cli.cleanupError = error;
    await cli.run();
    expect(audit.endExecution).toHaveBeenCalledWith(
      'execution-id',
      expect.objectContaining({
        success: false,
        exitCode: ErrorCode.EXECUTION_ERROR,
        error: `${phase} failed`,
      }),
    );
    expect(audit.close).toHaveBeenCalledOnce();
  });

  it('records returned failure with the declared exit code', async () => {
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    cli.unsuccessful = true;
    await cli.run();
    expect(audit.endExecution).toHaveBeenCalledWith(
      'execution-id',
      expect.objectContaining({
        success: false,
        exitCode: ErrorCode.EXECUTION_ERROR,
        error: 'handler refused',
      }),
    );
  });

  it('records cancellation without executing the handler', async () => {
    const cli = new FixtureCLI({ argv: ['delete'], exitOnComplete: false });
    cli.confirmed = false;
    await cli.run();
    expect(cli.effect).not.toHaveBeenCalled();
    expect(audit.endExecution).toHaveBeenCalledWith(
      'execution-id',
      expect.objectContaining({
        success: false,
        exitCode: ErrorCode.CANCELLED,
      }),
    );
  });

  it('records completed success', async () => {
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    await cli.run();
    expect(cli.effect).toHaveBeenCalledOnce();
    expect(audit.endExecution).toHaveBeenCalledWith(
      'execution-id',
      expect.objectContaining({
        success: true,
        exitCode: ErrorCode.SUCCESS,
      }),
    );
  });

  it('closes the logger if audit finalization fails', async () => {
    audit.endExecution.mockRejectedValue(new Error('audit unavailable'));
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    await cli.run();
    expect(audit.close).toHaveBeenCalledOnce();
  });

  it('does not lose a falsy audit finalization rejection', async () => {
    audit.endExecution.mockRejectedValue(0);
    const result = await new FixtureCLI({
      argv: ['delete', '--force'],
      exitOnComplete: false,
    }).run();
    expect(result.status).toBe('failed');
    expect(result.exitCode).not.toBe(ErrorCode.SUCCESS);
    expect(audit.close).toHaveBeenCalledOnce();
  });

  it('does not let command argument defaults clear a preceding simulation flag', async () => {
    const cli = new FixtureCLI({ argv: ['--dry-run', 'delete', '--force'], exitOnComplete: false });
    expect((await cli.run()).status).toBe('simulated');
    expect(cli.effect).not.toHaveBeenCalled();
  });

  it('keeps planning command metadata active despite an explicit false flag', async () => {
    const cli = new FixtureCLI({
      argv: ['plan', '--dry-run=false', '--force'],
      exitOnComplete: false,
    });
    expect((await cli.run()).status).toBe('simulated');
    expect(cli.effect).not.toHaveBeenCalled();
  });

  it.each(['SUCCESS', 'unknown', '0'])(
    'never returns exit zero for failed result code %s',
    async (code) => {
      const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
      cli.unsuccessful = true;
      cli.failureCode = code;
      expect(await cli.run()).toMatchObject({
        status: 'failed',
        exitCode: ErrorCode.GENERAL_ERROR,
      });
    },
  );

  it('classifies returned cancellation consistently', async () => {
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    cli.unsuccessful = true;
    cli.failureCode = 'CANCELLED';
    expect(await cli.run()).toMatchObject({ status: 'cancelled', exitCode: ErrorCode.CANCELLED });
  });

  it('preserves primary failure when cleanup and audit finalization also fail', async () => {
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    cli.handlerError = new ScriptError('primary handler failed', ErrorCode.EXECUTION_ERROR);
    cli.cleanupError = new Error('cleanup failed');
    audit.endExecution.mockRejectedValue(new Error('audit failed'));
    const result = await cli.run();
    expect(result).toMatchObject({
      status: 'failed',
      exitCode: ErrorCode.EXECUTION_ERROR,
      error: 'primary handler failed',
    });
    expect(result.secondaryErrors).toEqual(['cleanup failed', 'audit failed']);
    expect(audit.close).toHaveBeenCalledOnce();
  });

  it('resets per-run outcome and audit state when a CLI is reused', async () => {
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    cli.unsuccessful = true;
    expect((await cli.run()).status).toBe('failed');
    cli.unsuccessful = false;
    expect((await cli.run()).status).toBe('succeeded');
    expect(audit.startExecution).toHaveBeenCalledTimes(2);
    expect(audit.close).toHaveBeenCalledTimes(2);
    expect(audit.endExecution.mock.calls[1][1]).toMatchObject({
      success: true,
      exitCode: ErrorCode.SUCCESS,
    });
  });

  it('rejects overlapping runs on one instance before touching its audit state', async () => {
    let complete: (() => void) | undefined;
    const cli = new FixtureCLI({ argv: ['delete', '--force'], exitOnComplete: false });
    cli.waiting = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const first = cli.run();
    expect(await cli.run()).toMatchObject({ status: 'failed', exitCode: ErrorCode.INVALID_STATE });
    complete?.();
    expect((await first).status).toBe('succeeded');
    expect(audit.startExecution).toHaveBeenCalledOnce();
    expect(audit.endExecution).toHaveBeenCalledOnce();
  });
});
