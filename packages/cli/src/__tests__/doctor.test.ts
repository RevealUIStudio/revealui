import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock the logger to prevent console noise from node version validator.
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

import { execa } from 'execa';
import { getDoctorFixPlan } from '../commands/doctor.js';
import { gatherDoctorReport } from '../runtime/doctor.js';

const mockExeca = vi.mocked(execa);

describe('gatherDoctorReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports local db target when localhost URL is configured', async () => {
    mockExeca.mockImplementation(async (command, args) => {
      const joined = `${command} ${args?.join(' ')}`;
      if (joined.includes('command -v')) {
        return {} as Awaited<ReturnType<typeof execa>>;
      }
      throw new Error(`unexpected command: ${joined}`);
    });

    const report = await gatherDoctorReport(process.cwd(), {
      POSTGRES_URL: 'postgresql://postgres@localhost:5432/postgres',
      DIRENV_FILE: '/tmp/.envrc',
    });

    expect(report.dbTarget).toBe('local');
    expect(report.checks.find((check) => check.id === 'direnv')?.ok).toBe(true);
  });

  it('reports MCP readiness from configured credentials', async () => {
    mockExeca.mockImplementation(async (command, args) => {
      const joined = `${command} ${args?.join(' ')}`;
      if (joined.includes('command -v')) {
        return {} as Awaited<ReturnType<typeof execa>>;
      }
      throw new Error(`unexpected command: ${joined}`);
    });

    const report = await gatherDoctorReport(process.cwd(), {
      POSTGRES_URL: 'postgresql://postgres@localhost:5432/postgres',
      STRIPE_SECRET_KEY: 'sk_test_123',
    });

    const mcpCheck = report.checks.find((check) => check.id === 'mcp');
    expect(mcpCheck?.ok).toBe(true);
    expect(mcpCheck?.detail).toContain('stripe');
  });

  it('plans only safe automatic fixes', () => {
    const fixPlan = getDoctorFixPlan({
      workspaceRoot: '/tmp/revealui',
      dbTarget: 'local',
      checks: [
        { id: 'pg_ctl', ok: true, detail: 'pg_ctl available' },
        { id: 'initdb', ok: true, detail: 'initdb available' },
        { id: 'postgres', ok: false, detail: 'local postgres not reachable' },
        { id: 'mcp', ok: false, detail: 'mcp credentials missing' },
      ],
    });

    expect(fixPlan.attempted).toContain('initialize/start local postgres');
    expect(fixPlan.skipped).toContain(
      'MCP readiness requires credentials and cannot be auto-fixed safely',
    );
  });
});
