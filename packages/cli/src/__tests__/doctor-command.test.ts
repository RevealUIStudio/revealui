import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/setup/utils', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    header: vi.fn(),
    divider: vi.fn(),
  }),
}));

vi.mock('../runtime/doctor.js', () => ({
  gatherDoctorReport: vi.fn(),
  formatDoctorReport: vi.fn(() => 'doctor report'),
}));

vi.mock('../commands/db.js', () => ({
  runDbInitCommand: vi.fn(),
  runDbStartCommand: vi.fn(),
}));

import { runDoctorCommand } from '../commands/doctor.js';
import { gatherDoctorReport } from '../runtime/doctor.js';

const mockGatherDoctorReport = vi.mocked(gatherDoctorReport);

describe('runDoctorCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    vi.stubEnv('CI', '');
    mockGatherDoctorReport.mockResolvedValue({
      workspaceRoot: '/repo',
      dbTarget: 'missing',
      checks: [{ id: 'db-target', ok: false, detail: 'missing database url' }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not exit nonzero by default in interactive mode', async () => {
    await runDoctorCommand();
    expect(process.exitCode).toBeUndefined();
  });

  it('exits nonzero in strict mode', async () => {
    await runDoctorCommand({ strict: true });
    expect(process.exitCode).toBe(1);
  });
});
