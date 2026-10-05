/** Execute the maintained reset CLI with inert imports; never contact a database. */
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../scripts/setup/reset-database.ts',
);
let directory: string;
let loader: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'revealui-reset-inert-'));
  loader = join(directory, 'inert-imports.mjs');
  // The allowlisted loader replaces only I/O collaborators. The actual CLI
  // source/control flow runs unchanged, and Node owns its real exit behavior.
  await writeFile(
    loader,
    `
    import { registerHooks } from 'node:module';
    const logger = 'const log = () => undefined; export const createLogger = () => ({header:log,divider:log,info:log,debug:log,warn:log,error:log,success:log});';
    const utilities = logger + 'export const confirm = async () => true; export const detectDatabaseProvider = () => "postgres"; export const getProjectRoot = async () => process.cwd(); export const isCI = () => false; export const listTables = async () => ["first"]; export const validateDatabaseConnection = async () => ({connected:true});';
    const pg = 'export class Pool {async connect() {return {query:async (sql) => {if(sql.startsWith("SELECT * FROM")) throw new Error("injected read failure"); if(sql.includes("DROP TABLE")) console.log("DROP_CALLED"); return {rows:sql.includes("SELECT tablename FROM pg_tables") ? [{tablename:"first"}] : []};},release:()=>undefined};} async end(){}}';
    const backup = 'export async function createBackup(_connection,_url,options) {console.log("BACKUP_SHARED"); console.log("BACKUP_FORMAT:"+options.format); return process.env.RESET_TEST_BACKUP_RESULT === "success" ? {success:true,path:"synthetic-complete.json"} : {success:false,error:"injected read failure"};} export const listBackups=async()=>{console.log("RECENT_LISTED");return [];};';
    const connection = 'export async function createConnection() {return {close:async()=>console.log("BACKUP_CONNECTION_CLOSED")};} export const getRestConnectionString=()=>"postgresql://synthetic.invalid/synthetic";';
    const stubs = new Map([
      ['@revealui/scripts/index.js', utilities],
      ['@revealui/scripts/errors.js', 'export const ErrorCode = {CONFIG_ERROR:1,EXECUTION_ERROR:2};'],
      ['@revealui/scripts/database/ssl-config.js', 'export const getSSLConfig = () => undefined;'],
      ['@revealui/scripts/database/backup-manager.js', backup],
      ['@revealui/scripts/database/connection.js', connection],
      ['dotenv', 'export const config = () => ({parsed:{}});'],
      ['pg', pg],
      ['node:child_process', 'export const execSync = () => console.log("MIGRATE_CALLED");'],
    ]);
    registerHooks({resolve(specifier, context, next) {
      if (stubs.has(specifier)) return {url:'data:text/javascript,' + encodeURIComponent(stubs.get(specifier)),shortCircuit:true};
      return next(specifier,context);
    }});
  `,
  );
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function run(args: string[], backupResult = 'failure', command: 'reset' | 'backup' = 'reset') {
  const entry =
    command === 'reset' ? script : resolve(dirname(script), '../commands/database/backup.ts');
  return spawnSync(
    process.execPath,
    ['--import', loader, entry, '--confirm', '--database=rest', ...args],
    {
      cwd: directory,
      env: {
        NODE_ENV: 'test',
        POSTGRES_URL: 'postgresql://synthetic.invalid/synthetic',
        RESET_TEST_BACKUP_RESULT: backupResult,
      },
      encoding: 'utf8',
      timeout: 5000,
    },
  );
}

describe('reset shared backup gate', () => {
  it('refuses destructive reset after its requested backup fails', () => {
    const result = run([]);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('BACKUP_SHARED');
    expect(result.stdout).toContain('BACKUP_CONNECTION_CLOSED');
    expect(result.stdout).not.toContain('DROP_CALLED');
    expect(result.stdout).not.toContain('MIGRATE_CALLED');
  });

  it('preserves explicit no-backup reset selection', () => {
    const result = run(['--no-backup']);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('BACKUP_SHARED');
    expect(result.stdout).toContain('DROP_CALLED');
    expect(result.stdout).toContain('MIGRATE_CALLED');
  });

  it('closes the shared backup connection before continuing a successful reset', () => {
    const result = run([], 'success');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BACKUP_SHARED');
    expect(result.stdout.indexOf('BACKUP_CONNECTION_CLOSED')).toBeLessThan(
      result.stdout.indexOf('DROP_CALLED'),
    );
    expect(result.stdout).toContain('MIGRATE_CALLED');
  });
});

describe('backup CLI format contract', () => {
  it.each([
    [['--format=json'], 'json'],
    [['--format=sql'], 'sql'],
    [['--sql'], 'sql'],
  ] as const)('passes selected format %s to the shared producer', (args, expected) => {
    const result = run([...args], 'success', 'backup');
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain(`BACKUP_FORMAT:${expected}`);
  });

  it('rejects unsupported requested formats before connecting or producing', () => {
    const result = run(['--format=unknown'], 'success', 'backup');
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('BACKUP_SHARED');
    expect(result.stdout).not.toContain('BACKUP_CONNECTION_CLOSED');
  });

  it('closes the backup connection before a failed producer exits and skips success listing', () => {
    const result = run([], 'failure', 'backup');
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('BACKUP_SHARED');
    expect(result.stdout).toContain('BACKUP_CONNECTION_CLOSED');
    expect(result.stdout).not.toContain('RECENT_LISTED');
  });

  it.each(['0', '-1', '2.5', '3junk', ''])(
    'rejects invalid retention %s before connecting',
    (retain) => {
      const result = run([`--retain=${retain}`], 'success', 'backup');
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain('BACKUP_SHARED');
      expect(result.stdout).not.toContain('BACKUP_CONNECTION_CLOSED');
    },
  );
});
