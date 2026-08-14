#!/usr/bin/env tsx
/**
 * Official Vercel project settings must match each app vercel.json.
 *
 * SSOT is the per-app vercel.json (plus the project-id map). The dashboard
 * is a mirror. `check` compares live Project Settings; `sync` PATCHes them.
 *
 * GitHub Actions is the only official deploy path. Git Integration must stay
 * disconnected on these four projects.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
export const PROJECT_ID_MAP_PATH = join(REPO_ROOT, '.github', 'vercel-projects.json');
export const ROOT_VERCEL_JSON = join(REPO_ROOT, 'vercel.json');

export type OfficialApp = 'marketing' | 'docs' | 'admin' | 'api';

export interface OfficialAppSpec {
  app: OfficialApp;
  rootDirectory: string;
  vercelJsonPath: string;
}

export const OFFICIAL_APPS: readonly OfficialAppSpec[] = [
  {
    app: 'marketing',
    rootDirectory: 'apps/marketing',
    vercelJsonPath: 'apps/marketing/vercel.json',
  },
  { app: 'docs', rootDirectory: 'apps/docs', vercelJsonPath: 'apps/docs/vercel.json' },
  { app: 'admin', rootDirectory: 'apps/admin', vercelJsonPath: 'apps/admin/vercel.json' },
  { app: 'api', rootDirectory: 'apps/server', vercelJsonPath: 'apps/server/vercel.json' },
];

export interface AppVercelJson {
  framework?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
  installCommand?: string | null;
}

export interface ExpectedProjectSettings {
  app: OfficialApp;
  projectId: string;
  rootDirectory: string;
  framework: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  commandForIgnoringBuildStep: string;
  sourceFilesOutsideRootDirectory: true;
}

export interface LiveProjectSettings {
  id: string;
  name: string;
  framework: string | null;
  rootDirectory: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  commandForIgnoringBuildStep: string | null;
  sourceFilesOutsideRootDirectory: boolean | null;
  gitLinked: boolean;
}

export interface FieldDrift {
  field: string;
  expected: string;
  actual: string;
}

export interface ProjectIdMap {
  api: string;
  admin: string;
  marketing: string;
  docs: string;
}

export function loadProjectIdMap(
  raw: string = readFileSync(PROJECT_ID_MAP_PATH, 'utf8'),
): ProjectIdMap {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('.github/vercel-projects.json must be an object');
  }
  const rec = parsed as Record<string, unknown>;
  const required: Array<keyof ProjectIdMap> = ['api', 'admin', 'marketing', 'docs'];
  const out: Partial<ProjectIdMap> = {};
  for (const key of required) {
    const value = rec[key];
    if (typeof value !== 'string' || !value.startsWith('prj_')) {
      throw new Error(`.github/vercel-projects.json.${key} must be a prj_ id`);
    }
    out[key] = value;
  }
  return out as ProjectIdMap;
}

export function parseAppVercelJson(raw: string): AppVercelJson {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('vercel.json must be an object');
  }
  const rec = parsed as Record<string, unknown>;
  return {
    framework: rec.framework === undefined ? undefined : (rec.framework as string | null),
    buildCommand: rec.buildCommand === undefined ? undefined : (rec.buildCommand as string | null),
    outputDirectory:
      rec.outputDirectory === undefined ? undefined : (rec.outputDirectory as string | null),
    installCommand:
      rec.installCommand === undefined ? undefined : (rec.installCommand as string | null),
  };
}

export function expectedSettingsForApp(
  spec: OfficialAppSpec,
  ids: ProjectIdMap,
  vercelJsonRaw: string,
): ExpectedProjectSettings {
  const cfg = parseAppVercelJson(vercelJsonRaw);
  if (cfg.buildCommand === undefined || cfg.buildCommand === null || cfg.buildCommand === '') {
    throw new Error(`${spec.vercelJsonPath} must set buildCommand`);
  }
  if (cfg.framework === undefined) {
    throw new Error(`${spec.vercelJsonPath} must set framework (use null for Other)`);
  }
  return {
    app: spec.app,
    projectId: ids[spec.app],
    rootDirectory: spec.rootDirectory,
    framework: cfg.framework,
    buildCommand: cfg.buildCommand,
    outputDirectory: cfg.outputDirectory ?? null,
    installCommand: cfg.installCommand ?? null,
    commandForIgnoringBuildStep: 'exit 1',
    sourceFilesOutsideRootDirectory: true,
  };
}

export function loadExpectedSettings(repoRoot: string = REPO_ROOT): ExpectedProjectSettings[] {
  const ids = loadProjectIdMap(
    readFileSync(join(repoRoot, '.github', 'vercel-projects.json'), 'utf8'),
  );
  return OFFICIAL_APPS.map((spec) =>
    expectedSettingsForApp(spec, ids, readFileSync(join(repoRoot, spec.vercelJsonPath), 'utf8')),
  );
}

export function assertRootVercelJsonGuard(raw: string): string[] {
  const errors: string[] = [];
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ['root vercel.json must be an object'];
  }
  const rec = parsed as Record<string, unknown>;
  const git = rec.git;
  if (!git || typeof git !== 'object' || Array.isArray(git)) {
    errors.push('root vercel.json must set git.deploymentEnabled to false');
    return errors;
  }
  const enabled = (git as Record<string, unknown>).deploymentEnabled;
  if (enabled !== false) {
    errors.push('root vercel.json git.deploymentEnabled must be false');
  }
  if (
    rec.framework !== undefined ||
    rec.buildCommand !== undefined ||
    rec.outputDirectory !== undefined
  ) {
    errors.push(
      'root vercel.json must not set framework/buildCommand/outputDirectory (official apps live under apps/*)',
    );
  }
  return errors;
}

function display(value: string | null | undefined | boolean): string {
  if (value === undefined || value === null) return '(unset)';
  if (value === '') return '(empty)';
  if (value === true) return 'true';
  if (value === false) return 'false';
  return value;
}

export function diffProjectSettings(
  expected: ExpectedProjectSettings,
  live: LiveProjectSettings,
): FieldDrift[] {
  const drifts: FieldDrift[] = [];
  const pairs: Array<[string, string | null | boolean, string | null | boolean | undefined]> = [
    ['framework', expected.framework, live.framework],
    ['rootDirectory', expected.rootDirectory, live.rootDirectory],
    ['buildCommand', expected.buildCommand, live.buildCommand],
    ['outputDirectory', expected.outputDirectory, live.outputDirectory],
    ['installCommand', expected.installCommand, live.installCommand],
    [
      'commandForIgnoringBuildStep',
      expected.commandForIgnoringBuildStep,
      live.commandForIgnoringBuildStep,
    ],
    [
      'sourceFilesOutsideRootDirectory',
      expected.sourceFilesOutsideRootDirectory,
      live.sourceFilesOutsideRootDirectory,
    ],
  ];
  for (const [field, exp, act] of pairs) {
    const expS = display(exp);
    const actS = display(act);
    if (expS !== actS) {
      drifts.push({ field, expected: expS, actual: actS });
    }
  }
  if (live.gitLinked) {
    drifts.push({
      field: 'git',
      expected: 'disconnected',
      actual: 'connected',
    });
  }
  return drifts;
}

export function liveFromApiBody(body: Record<string, unknown>): LiveProjectSettings {
  const link = body.link;
  const gitLinked = Boolean(
    link && typeof link === 'object' && !Array.isArray(link) && 'type' in link,
  );
  return {
    id: typeof body.id === 'string' ? body.id : '',
    name: typeof body.name === 'string' ? body.name : '',
    framework: (body.framework as string | null | undefined) ?? null,
    rootDirectory: (body.rootDirectory as string | null | undefined) ?? null,
    buildCommand: (body.buildCommand as string | null | undefined) ?? null,
    outputDirectory: (body.outputDirectory as string | null | undefined) ?? null,
    installCommand: (body.installCommand as string | null | undefined) ?? null,
    commandForIgnoringBuildStep:
      (body.commandForIgnoringBuildStep as string | null | undefined) ?? null,
    sourceFilesOutsideRootDirectory:
      typeof body.sourceFilesOutsideRootDirectory === 'boolean'
        ? body.sourceFilesOutsideRootDirectory
        : null,
    gitLinked,
  };
}

export function patchBodyFromExpected(expected: ExpectedProjectSettings): Record<string, unknown> {
  return {
    framework: expected.framework,
    rootDirectory: expected.rootDirectory,
    buildCommand: expected.buildCommand,
    outputDirectory: expected.outputDirectory,
    installCommand: expected.installCommand,
    commandForIgnoringBuildStep: expected.commandForIgnoringBuildStep,
    sourceFilesOutsideRootDirectory: expected.sourceFilesOutsideRootDirectory,
  };
}

function runVercelApi(path: string, method: 'GET' | 'PATCH', body?: unknown): unknown {
  const args = ['api', path, '--method', method];
  const token = process.env.VERCEL_TOKEN;
  if (token && token.length > 0) {
    args.push('--token', token);
  }
  if (body !== undefined) {
    args.push('--input', '-');
  }
  const result = spawnSync('vercel', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  if (result.status !== 0) {
    throw new Error(
      `vercel api ${method} ${path} failed: ${(result.stderr || result.stdout || '').trim()}`,
    );
  }
  return JSON.parse(result.stdout);
}

export async function fetchLiveProject(projectId: string): Promise<LiveProjectSettings> {
  const body = runVercelApi(`/v9/projects/${projectId}`, 'GET');
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`unexpected GET /v9/projects/${projectId} body`);
  }
  return liveFromApiBody(body as Record<string, unknown>);
}

export async function syncLiveProject(expected: ExpectedProjectSettings): Promise<void> {
  runVercelApi(`/v9/projects/${expected.projectId}`, 'PATCH', patchBodyFromExpected(expected));
}

export async function strayRevealuiProjectExists(): Promise<boolean> {
  const args = ['api', '/v9/projects/revealui'];
  const token = process.env.VERCEL_TOKEN;
  if (token && token.length > 0) args.push('--token', token);
  const result = spawnSync('vercel', args, { encoding: 'utf8' });
  if (result.status !== 0) return false;
  try {
    const body: unknown = JSON.parse(result.stdout);
    return Boolean(body && typeof body === 'object' && !Array.isArray(body) && 'id' in body);
  } catch {
    return false;
  }
}

function printDrifts(app: string, drifts: FieldDrift[]): void {
  for (const d of drifts) {
    console.error(`  ${app}.${d.field}: expected ${d.expected}  actual ${d.actual}`);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const sync = argv.includes('--sync');
  const live = argv.includes('--live') || sync;

  const fileErrors: string[] = [];
  try {
    fileErrors.push(
      ...assertRootVercelJsonGuard(readFileSync(join(REPO_ROOT, 'vercel.json'), 'utf8')),
    );
  } catch (err) {
    fileErrors.push(`root vercel.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  let expected: ExpectedProjectSettings[] = [];
  try {
    expected = loadExpectedSettings(REPO_ROOT);
  } catch (err) {
    fileErrors.push(err instanceof Error ? err.message : String(err));
  }

  if (fileErrors.length > 0) {
    for (const e of fileErrors) console.error(e);
    return 1;
  }

  if (!live) {
    console.log(
      `vercel.json lockstep: ${expected.length} official apps ok (pass --live to compare dashboard)`,
    );
    return 0;
  }

  let failed = 0;
  if (await strayRevealuiProjectExists()) {
    console.error(
      'stray Vercel project "revealui" exists; official apps are revealui-{marketing,docs,admin,api}',
    );
    failed += 1;
  }

  for (const exp of expected) {
    const current = await fetchLiveProject(exp.projectId);
    if (sync) {
      const before = diffProjectSettings(exp, current);
      if (before.length === 0) {
        console.log(`${exp.app} (${exp.projectId}): already matches`);
        continue;
      }
      console.log(`${exp.app}: syncing ${before.map((d) => d.field).join(', ')}`);
      await syncLiveProject(exp);
      const after = diffProjectSettings(exp, await fetchLiveProject(exp.projectId));
      if (after.length > 0) {
        printDrifts(exp.app, after);
        failed += 1;
      }
      continue;
    }
    const drifts = diffProjectSettings(exp, current);
    if (drifts.length === 0) {
      console.log(`${exp.app}: matches apps/${exp.app === 'api' ? 'server' : exp.app}/vercel.json`);
      continue;
    }
    printDrifts(exp.app, drifts);
    failed += 1;
  }

  if (failed > 0 && !sync) {
    console.error('Fix: pnpm validate:vercel-settings -- --sync');
  }
  return failed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  });
}
