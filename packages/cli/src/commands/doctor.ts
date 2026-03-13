import { createLogger } from '@revealui/setup/utils';
import { formatDoctorReport, gatherDoctorReport } from '../runtime/doctor.js';
import { runDbInitCommand, runDbStartCommand } from './db.js';

const logger = createLogger({ prefix: 'Doctor' });

export interface DoctorFixResult {
  attempted: string[];
  skipped: string[];
}

export function getDoctorFixPlan(
  report: Awaited<ReturnType<typeof gatherDoctorReport>>,
): DoctorFixResult {
  const attempted: string[] = [];
  const skipped: string[] = [];

  const postgresCheck = report.checks.find((check) => check.id === 'postgres');
  const initdbCheck = report.checks.find((check) => check.id === 'initdb');
  const pgCtlCheck = report.checks.find((check) => check.id === 'pg_ctl');
  const mcpCheck = report.checks.find((check) => check.id === 'mcp');

  if (report.dbTarget === 'local' && postgresCheck && !postgresCheck.ok) {
    if (initdbCheck?.ok && pgCtlCheck?.ok) {
      attempted.push('initialize/start local postgres');
    } else {
      skipped.push('local postgres repair requires both initdb and pg_ctl in PATH');
    }
  }

  if (mcpCheck && !mcpCheck.ok) {
    skipped.push('MCP readiness requires credentials and cannot be auto-fixed safely');
  }

  if (attempted.length === 0 && skipped.length === 0) {
    skipped.push('no safe automatic fixes available');
  }

  return { attempted, skipped };
}

async function applyDoctorFixes(
  report: Awaited<ReturnType<typeof gatherDoctorReport>>,
): Promise<DoctorFixResult> {
  const plan = getDoctorFixPlan(report);

  if (plan.attempted.includes('initialize/start local postgres')) {
    try {
      await runDbInitCommand();
    } catch {
      // Ignore "already initialized" and other init conflicts; start may still succeed.
    }
    await runDbStartCommand();
  }

  return plan;
}

function formatDoctorFixPlan(plan: DoctorFixResult): string {
  const lines = ['', 'RevealUI Doctor Fix Plan', ''];
  for (const action of plan.attempted) {
    lines.push(`fix      ${action}`);
  }
  for (const action of plan.skipped) {
    lines.push(`skip     ${action}`);
  }
  return lines.join('\n');
}

export async function runDoctorCommand(
  options: { json?: boolean; fix?: boolean; strict?: boolean } = {},
): Promise<void> {
  let report = await gatherDoctorReport();
  const fixPlan = getDoctorFixPlan(report);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ report, fixPlan }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatDoctorReport(report)}\n`);
  process.stdout.write(`${formatDoctorFixPlan(fixPlan)}\n`);

  if (options.fix) {
    if (fixPlan.attempted.length === 0) {
      logger.warn('No safe automatic fixes available');
    } else {
      await applyDoctorFixes(report);
      report = await gatherDoctorReport();
      process.stdout.write(`${formatDoctorReport(report)}\n`);
    }
  }

  if (report.checks.some((check) => !check.ok)) {
    logger.warn('Some checks failed');
    if (options.strict || options.json || process.env.CI) {
      process.exitCode = 1;
    }
  }
}
