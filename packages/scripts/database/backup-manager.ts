/** Data-only PostgreSQL backup/restore into a compatible existing public schema. */
import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeIdentifier, escapeLiteral } from '@revealui/db/orm';
import { type Node as JsonNode, type ParseError, parseTree } from 'jsonc-parser';
import { parse } from 'pgsql-parser';
import { createLogger, getProjectRoot, type Logger } from '../index.js';
import type { DatabaseConnection } from './connection.js';

type PoolClient = Awaited<ReturnType<DatabaseConnection['connect']>>;

import { withTransaction } from './transaction-manager.js';

export interface BackupOptions {
  backupDir?: string;
  retainCount?: number;
  tables?: string[];
  format?: 'json' | 'sql';
  logger?: Logger;
}
export interface BackupMetadata {
  id: string;
  timestamp: Date;
  tables: string[];
  rowCounts: Record<string, number>;
  format: 'json' | 'sql';
  size: number;
}
export interface BackupResult {
  success: boolean;
  path?: string;
  metadata?: BackupMetadata;
  error?: string;
  /** A completed artifact exists, but retention could not finish. */
  warning?: string;
}
type Row = Record<string, unknown>;
interface RestorePlan {
  encoding: 'legacy' | 'postgres-text' | 'sql-literal';
  tables: Map<string, Row[]>;
}
interface Column {
  name: string;
  type: string;
  namespace: string;
  declaration: string;
  modifier: number;
  generated: string;
  identity: string;
}
const defaultLogger = createLogger({ level: 'silent' });
const tableName = (name: string) => `"public".${escapeIdentifier(name)}`;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a backup object');
  return value as Record<string, unknown>;
}
function name(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0'))
    throw new Error('Invalid backup identifier');
  return value;
}
function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error('Unsupported backup SQL syntax');
}
function validateRows(value: unknown, encoding: RestorePlan['encoding']): Row[] {
  if (!Array.isArray(value)) throw new Error('Backup table must contain a row array');
  let columns: string[] | undefined;
  return value.map((raw) => {
    const row = object(raw);
    const current = Object.keys(row).map(name).sort();
    if (
      !current.length ||
      (columns &&
        (columns.length !== current.length || columns.some((column, i) => column !== current[i])))
    )
      throw new Error('Backup rows must have identical nonempty column sets');
    columns = current;
    for (const cell of Object.values(row)) {
      if (encoding === 'postgres-text' && cell !== null && typeof cell !== 'string')
        throw new Error('PostgreSQL text encoding requires strings or null');
      if (
        encoding === 'sql-literal' &&
        cell !== null &&
        typeof cell !== 'string' &&
        typeof cell !== 'number' &&
        typeof cell !== 'boolean'
      )
        throw new Error('Unsupported PostgreSQL literal');
      if (typeof cell === 'number' && !Number.isFinite(cell))
        throw new Error('Nonfinite JSON number');
      if (cell === undefined) throw new Error('Missing backup value');
    }
    return row;
  });
}
function jsonPlan(content: string): RestorePlan {
  const errors: ParseError[] = [];
  const tree = parseTree(content, errors, { disallowComments: true, allowTrailingComma: false });
  if (!tree || errors.length) throw new Error('Invalid JSON backup');
  function inspect(node: JsonNode): void {
    if (node.type === 'object') {
      const names = (node.children ?? []).map((property) => property.children?.[0]?.value);
      if (new Set(names).size !== names.length) throw new Error('Duplicate JSON backup key');
    }
    if (
      node.type === 'number' &&
      (!Number.isFinite(node.value) ||
        (Number.isInteger(node.value) && !Number.isSafeInteger(node.value)))
    )
      throw new Error('JSON number cannot be represented without loss');
    for (const child of node.children ?? []) inspect(child);
  }
  inspect(tree);
  const parsed = object(JSON.parse(content));
  let encoding: RestorePlan['encoding'] = 'legacy';
  let raw = parsed;
  if (parsed.version === 1 && parsed.encoding === 'postgres-text') {
    keys(parsed, ['version', 'encoding', 'tables']);
    encoding = 'postgres-text';
    raw = object(parsed.tables);
  }
  const tables = new Map<string, Row[]>();
  for (const [table, rows] of Object.entries(raw))
    tables.set(name(table), validateRows(rows, encoding));
  return { encoding, tables };
}
function range(raw: unknown): string {
  const relation = object(raw);
  keys(relation, ['relname', 'schemaname', 'inh', 'relpersistence', 'location']);
  if (relation.schemaname !== undefined && relation.schemaname !== 'public')
    throw new Error('Only public-schema data backups are supported');
  return name(relation.relname);
}
function literal(raw: unknown): unknown {
  const node = object(raw);
  keys(node, ['A_Const']);
  const constant = object(node.A_Const);
  keys(constant, ['isnull', 'ival', 'fval', 'sval', 'boolval', 'location']);
  if (constant.isnull === true) return null;
  for (const kind of ['ival', 'fval', 'sval', 'boolval']) {
    if (constant[kind] !== undefined) {
      const holder = object(constant[kind]);
      keys(holder, [kind]);
      // The maintained protobuf AST omits scalar defaults but retains the
      // literal-kind wrapper: ival:{} is 0, boolval:{} is FALSE, sval:{} is ''.
      const value =
        holder[kind] ??
        (kind === 'ival' ? 0 : kind === 'boolval' ? false : kind === 'sval' ? '' : undefined);
      if (
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isSafeInteger(value))
      )
        return value;
    }
  }
  throw new Error('Only literal SQL values are supported');
}
async function sqlPlan(content: string): Promise<RestorePlan> {
  const parsed = object(await parse(content));
  if (!Array.isArray(parsed.stmts)) throw new Error('Invalid PostgreSQL backup');
  const tables = new Map<string, Row[]>();
  for (const raw of parsed.stmts) {
    const wrapper = object(object(raw).stmt);
    keys(wrapper, ['InsertStmt']);
    const insert = object(wrapper.InsertStmt);
    keys(insert, ['relation', 'cols', 'selectStmt', 'override']);
    if (insert.override && insert.override !== 'OVERRIDING_NOT_SET')
      throw new Error('Unsupported INSERT override');
    const table = range(insert.relation);
    const selectWrapper = object(insert.selectStmt);
    keys(selectWrapper, ['SelectStmt']);
    const select = object(selectWrapper.SelectStmt);
    if (select.op !== undefined && select.op !== 'SETOP_NONE')
      throw new Error('Unsupported SQL set operation');
    if (select.limitOption !== undefined && select.limitOption !== 'LIMIT_OPTION_DEFAULT')
      throw new Error('Unsupported SQL limit');
    const rows = tables.get(table) ?? [];
    if (Array.isArray(select.valuesLists)) {
      keys(select, ['valuesLists', 'op', 'limitOption']);
      if (!Array.isArray(insert.cols) || insert.cols.length === 0)
        throw new Error('SQL backup must name columns');
      const columns = insert.cols.map((rawColumn) => {
        const outer = object(rawColumn);
        keys(outer, ['ResTarget']);
        const column = object(outer.ResTarget);
        keys(column, ['name', 'location']);
        return name(column.name);
      });
      if (new Set(columns).size !== columns.length) throw new Error('Duplicate SQL column');
      for (const rawValues of select.valuesLists) {
        const valuesWrapper = object(rawValues);
        keys(valuesWrapper, ['List']);
        const list = object(valuesWrapper.List);
        keys(list, ['items']);
        if (!Array.isArray(list.items) || list.items.length !== columns.length)
          throw new Error('SQL value count mismatch');
        rows.push(
          Object.fromEntries(
            columns.map((column, i) => [column, literal((list.items as unknown[])[i])]),
          ),
        );
      }
    } else {
      // Exact producer declaration: INSERT INTO public.t SELECT * FROM public.t WHERE FALSE.
      keys(select, ['targetList', 'fromClause', 'whereClause', 'op', 'limitOption']);
      if (
        insert.cols !== undefined ||
        !Array.isArray(select.targetList) ||
        select.targetList.length !== 1 ||
        !Array.isArray(select.fromClause) ||
        select.fromClause.length !== 1
      )
        throw new Error('Unsupported empty-table declaration');
      const targetOuter = object(select.targetList[0]);
      keys(targetOuter, ['ResTarget']);
      const target = object(targetOuter.ResTarget);
      keys(target, ['val', 'location']);
      const value = object(target.val);
      keys(value, ['ColumnRef']);
      const column = object(value.ColumnRef);
      keys(column, ['fields', 'location']);
      if (!Array.isArray(column.fields) || column.fields.length !== 1)
        throw new Error('Unsupported empty-table target');
      const star = object(column.fields[0]);
      keys(star, ['A_Star']);
      if (!('A_Star' in star) || Object.keys(object(star.A_Star)).length)
        throw new Error('Unsupported empty-table target');
      const source = object(select.fromClause[0]);
      keys(source, ['RangeVar']);
      if (
        range(source.RangeVar) !== table ||
        literal(select.whereClause) !== false ||
        tables.has(table)
      )
        throw new Error('Invalid or duplicate empty-table declaration');
    }
    tables.set(table, rows);
  }
  for (const [table, rows] of tables) tables.set(table, validateRows(rows, 'sql-literal'));
  return { encoding: 'sql-literal', tables };
}
async function decode(content: string, format: 'json' | 'sql'): Promise<RestorePlan> {
  return format === 'json' ? jsonPlan(content) : sqlPlan(content);
}
/** Inspect artifact syntax and row counts through the same restore decoder. */
export async function inspectBackup(
  content: string,
  format: 'json' | 'sql',
): Promise<{
  tables: string[];
  rowCounts: Record<string, number>;
}> {
  if (format !== 'json' && format !== 'sql') throw new Error('Unsupported backup format');
  const plan = await decode(content, format);
  return {
    tables: [...plan.tables.keys()],
    rowCounts: Object.fromEntries([...plan.tables].map(([table, rows]) => [table, rows.length])),
  };
}
async function discover(client: PoolClient): Promise<string[]> {
  const result = await client.query<{
    name: string;
    kind: string;
    inherited: boolean;
  }>(`SELECT c.relname AS name, c.relkind AS kind,
    EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid) AS inherited
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','f') ORDER BY c.relname`);
  for (const row of result.rows)
    if (row.kind !== 'r' || row.inherited)
      throw new Error(`Unsupported partitioned, inherited or foreign table: ${row.name}`);
  return result.rows.map((row) => row.name);
}
async function columns(client: PoolClient, table: string): Promise<Column[]> {
  const result = await client.query<Column>(
    `SELECT a.attname AS name, t.typname AS type, n.nspname AS namespace, pg_catalog.format_type(a.atttypid, a.atttypmod) AS declaration, a.atttypmod AS modifier, a.attgenerated AS generated, a.attidentity AS identity
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
    [tableName(table)],
  );
  if (!result.rows.length) throw new Error(`Unsupported table without columns: ${table}`);
  for (const column of result.rows)
    if (column.generated || column.identity)
      throw new Error(
        `Generated and identity columns are outside this data-only backup contract: ${table}.${column.name}`,
      );
  return result.rows;
}
async function restoreOrder(
  client: PoolClient,
  names: string[],
  clear: boolean,
): Promise<string[]> {
  const result = await client.query<{
    child: string;
    parent: string;
    child_schema: string;
    parent_schema: string;
  }>(`SELECT child.relname AS child, parent.relname AS parent, cn.nspname AS child_schema, pn.nspname AS parent_schema
    FROM pg_catalog.pg_constraint fk JOIN pg_catalog.pg_class child ON child.oid=fk.conrelid
    JOIN pg_catalog.pg_class parent ON parent.oid=fk.confrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=child.relnamespace
    JOIN pg_catalog.pg_namespace pn ON pn.oid=parent.relnamespace WHERE fk.contype='f'`);
  const remaining = new Set(names);
  const parents = new Map(names.map((table) => [table, new Set<string>()]));
  for (const fk of result.rows) {
    const childIn = fk.child_schema === 'public' && remaining.has(fk.child);
    const parentIn = fk.parent_schema === 'public' && remaining.has(fk.parent);
    if (clear && parentIn && !childIn)
      throw new Error(`Restore target has an omitted inbound foreign key: ${fk.parent}`);
    if (childIn && parentIn) parents.get(fk.child)?.add(fk.parent);
  }
  const ordered: string[] = [];
  while (remaining.size) {
    const ready = [...remaining]
      .filter((table) => [...(parents.get(table) ?? [])].every((parent) => !remaining.has(parent)))
      .sort();
    if (!ready.length) throw new Error('Cyclic foreign keys are outside this restore contract');
    for (const table of ready) {
      remaining.delete(table);
      ordered.push(table);
    }
  }
  return ordered;
}
async function completed(backupDir: string): Promise<string[]> {
  const files = await readdir(backupDir);
  const found: Array<{ file: string; age: number }> = [];
  for (const file of files) {
    if (
      !(
        (file.startsWith('backup-') || file.startsWith('db-backup-')) &&
        (file.endsWith('.json') || file.endsWith('.sql'))
      )
    )
      continue;
    const stat = await lstat(join(backupDir, file));
    if (!stat.isFile()) continue;
    found.push({ file, age: stat.mtimeMs });
  }
  return found
    .sort((a, b) => b.age - a.age || b.file.localeCompare(a.file))
    .map(({ file }) => file);
}
async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function createBackup(
  connection: DatabaseConnection,
  importMetaUrl: string,
  options: BackupOptions = {},
): Promise<BackupResult> {
  const { retainCount = 5, format = 'json', logger = defaultLogger } = options;
  let stage: string | undefined;
  try {
    if (!Number.isSafeInteger(retainCount) || retainCount < 1)
      throw new Error('Retention count must be a positive safe integer');
    if (format !== 'json' && format !== 'sql') throw new Error('Unsupported backup format');
    if (options.tables && new Set(options.tables).size !== options.tables.length)
      throw new Error('Duplicate requested table');
    const backupDir =
      options.backupDir || join(await getProjectRoot(importMetaUrl), '.revealui', 'backups');
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date();
    const backupId = `backup-${timestamp.toISOString().split(':').join('-').split('.').join('-')}-${randomUUID()}`;
    const path = join(backupDir, `${backupId}.${format}`);
    const snapshot = await withTransaction(
      connection,
      async ({ client }) => {
        await client.query('SET LOCAL row_security = off');
        await client.query("SET LOCAL DateStyle = 'ISO, YMD'");
        await client.query("SET LOCAL IntervalStyle = 'postgres'");
        await client.query("SET LOCAL TimeZone = 'UTC'");
        await client.query("SET LOCAL bytea_output = 'hex'");
        await client.query('SET LOCAL extra_float_digits = 3');
        const priorPath = await inputSearchPath(client);
        const available = await discover(client);
        const selected = options.tables?.map(name) ?? available;
        for (const table of selected)
          if (!available.includes(table))
            throw new Error(`Requested backup table does not exist: ${table}`);
        const data: Record<string, Row[]> = Object.create(null);
        const rowCounts: Record<string, number> = Object.create(null);
        for (const table of selected) {
          const fields = await columns(client, table);
          const result = await client.query<Row>(
            `SELECT ${fields.map((column) => `${escapeIdentifier(column.name)}::text AS ${escapeIdentifier(column.name)}`).join(', ')} FROM ONLY ${tableName(table)}`,
          );
          await validateInput(client, fields, result.rows, 'postgres-text');
          data[table] = result.rows;
          rowCounts[table] = result.rows.length;
        }
        await client.query("SELECT pg_catalog.set_config('search_path', $1, true)", [priorPath]);
        let content: string;
        if (format === 'json')
          content = JSON.stringify(
            { version: 1, encoding: 'postgres-text', tables: data },
            null,
            2,
          );
        else {
          const statements = [
            '-- RevealUI data-only PostgreSQL backup',
            `-- Created: ${timestamp.toISOString()}`,
          ];
          for (const [table, rows] of Object.entries(data)) {
            if (!rows.length)
              statements.push(
                `INSERT INTO ${tableName(table)} SELECT * FROM ${tableName(table)} WHERE FALSE;`,
              );
            for (const row of rows) {
              const cols = Object.keys(row);
              statements.push(
                `INSERT INTO ${tableName(table)} (${cols.map(escapeIdentifier).join(', ')}) VALUES (${cols.map((col) => (row[col] === null ? 'NULL' : escapeLiteral(String(row[col])))).join(', ')});`,
              );
            }
          }
          content = statements.join('\n');
        }
        const verified = await decode(content, format);
        if (
          verified.tables.size !== selected.length ||
          selected.some((table) => verified.tables.get(table)?.length !== rowCounts[table])
        )
          throw new Error('Backup completeness validation failed');
        return { content, tables: selected, rowCounts };
      },
      { isolationLevel: 'repeatable read', readOnly: true, logger },
    );
    stage = join(backupDir, `.backup-stage-${randomUUID()}`);
    const handle = await open(stage, 'wx', 0o600);
    try {
      await handle.writeFile(snapshot.content, 'utf8');
      // Retention follows the producer's declared local snapshot timestamp,
      // even if reading or publication finishes after a newer producer.
      await handle.utimes(timestamp, timestamp);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if ((await readFile(stage, 'utf8')) !== snapshot.content)
      throw new Error('Backup staging verification failed');
    // Atomic no-clobber publication in the same filesystem; staging is never listed.
    await link(stage, path);
    await unlink(stage);
    stage = undefined;
    await syncDirectory(backupDir);
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      tables: snapshot.tables,
      rowCounts: snapshot.rowCounts,
      format,
      size: Buffer.byteLength(snapshot.content),
    };
    let warning: string | undefined;
    try {
      const files = await completed(backupDir);
      // A late publisher must never prune artifacts from a newer snapshot.
      // Concurrent publication may temporarily exceed the retention target.
      if (files[0] !== `${backupId}.${format}`) {
        warning = 'Backup published; retention deferred to a newer publisher';
      } else {
        for (const file of files.slice(retainCount)) await unlink(join(backupDir, file));
        await syncDirectory(backupDir);
      }
    } catch (error) {
      warning = `Backup published; retention failed: ${message(error)}`;
      logger.warn(warning);
    }
    logger.success(`Backup created: ${path}`);
    return { success: true, path, metadata, ...(warning ? { warning } : {}) };
  } catch (error) {
    if (stage) {
      try {
        await unlink(stage);
      } catch (cleanupError) {
        logger.warn(`Backup staging cleanup failed: ${message(cleanupError)}`);
      }
    }
    const errorMessage = message(error);
    logger.error(`Backup failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
export async function restoreBackup(
  connection: DatabaseConnection,
  backupPath: string,
  options: { logger?: Logger; clearTables?: boolean; signal?: AbortSignal; timeout?: number } = {},
): Promise<{ success: boolean; error?: string }> {
  const { logger = defaultLogger, clearTables = true } = options;
  try {
    const format = backupPath.endsWith('.json')
      ? 'json'
      : backupPath.endsWith('.sql')
        ? 'sql'
        : undefined;
    if (!format) throw new Error('Unsupported backup format');
    const plan = await decode(await readFile(backupPath, 'utf8'), format);
    await withTransaction(
      connection,
      async ({ client }) => {
        await client.query('SET LOCAL row_security = off');
        await client.query("SET LOCAL DateStyle = 'ISO, YMD'");
        await client.query("SET LOCAL IntervalStyle = 'postgres'");
        await client.query("SET LOCAL TimeZone = 'UTC'");
        await client.query("SET LOCAL bytea_output = 'hex'");
        await client.query('SET LOCAL extra_float_digits = 3');
        const names = [...plan.tables.keys()];
        if (names.length)
          await client.query(
            `LOCK TABLE ${names.slice().sort().map(tableName).join(', ')} IN SHARE ROW EXCLUSIVE MODE`,
          );
        const priorPath = await inputSearchPath(client);
        const available = await discover(client);
        const schemas = new Map<string, Column[]>();
        for (const [table, rows] of plan.tables) {
          if (!available.includes(table)) throw new Error(`Restore table does not exist: ${table}`);
          const fields = await columns(client, table);
          schemas.set(table, fields);
          for (const row of rows)
            for (const column of Object.keys(row))
              if (!fields.some((field) => field.name === column))
                throw new Error(`Restore column does not exist: ${table}.${column}`);
        }
        const ordered = await restoreOrder(client, names, clearTables);
        // Validate PostgreSQL input conversion before clearing any table.
        for (const [table, rows] of plan.tables)
          await validateInput(client, schemas.get(table) ?? [], rows, plan.encoding);
        await client.query("SELECT pg_catalog.set_config('search_path', $1, true)", [priorPath]);
        if (clearTables)
          for (const table of ordered.slice().reverse())
            await client.query(`DELETE FROM ONLY ${tableName(table)}`);
        for (const table of ordered)
          for (const row of plan.tables.get(table) ?? []) {
            options.signal?.throwIfAborted();
            const cols = Object.keys(row);
            const values = cols.map((col) =>
              cell(
                row[col],
                schemas.get(table)?.find((field) => field.name === col)?.type,
                plan.encoding,
              ),
            );
            await client.query(
              `INSERT INTO ${tableName(table)} (${cols.map(escapeIdentifier).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
              values,
            );
          }
      },
      { logger, signal: options.signal, timeout: options.timeout },
    );
    logger.success('Restore completed');
    return { success: true };
  } catch (error) {
    const errorMessage = message(error);
    logger.error(`Restore failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
async function validateInput(
  client: PoolClient,
  fields: Column[],
  rows: Row[],
  encoding: RestorePlan['encoding'],
): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row);
    const values = cols.map((col) =>
      cell(row[col], fields.find((field) => field.name === col)?.type, encoding),
    );
    const modified = cols.filter(
      (col) => (fields.find((field) => field.name === col)?.modifier ?? -1) >= 0,
    );
    if (modified.length) {
      const equality = await client.query<{ preserved: boolean }>(
        `SELECT ${modified
          .map((col, index) => {
            const field = fields.find((entry) => entry.name === col);
            const parameter = `$${index + 1}`;
            return `(${parameter}::${typeName(field)} IS NOT DISTINCT FROM ${parameter}::${declaration(field)})`;
          })
          .join(' AND ')} AS preserved`,
        modified.map((col) => values[cols.indexOf(col)]),
      );
      if (equality.rows[0]?.preserved !== true)
        throw new Error('PostgreSQL column modifiers do not preserve the backup value');
    }
    const converted = await client.query<Row>(
      `SELECT ${cols.map((col, i) => `$${i + 1}::${declaration(fields.find((field) => field.name === col))}::text AS ${escapeIdentifier(col)}`).join(', ')}`,
      values,
    );
    if (encoding === 'postgres-text' && cols.some((col) => converted.rows[0]?.[col] !== row[col])) {
      throw new Error('PostgreSQL text input does not preserve the canonical backup value');
    }
  }
}
async function inputSearchPath(client: PoolClient): Promise<string> {
  const prior = await client.query<{ path: string }>(
    "SELECT pg_catalog.current_setting('search_path') AS path",
  );
  await client.query("SELECT pg_catalog.set_config('search_path', 'pg_catalog', true)");
  return prior.rows[0].path;
}
function declaration(column: Column | undefined): string {
  if (!column?.declaration) throw new Error('Missing PostgreSQL column declaration');
  return column.declaration;
}
function typeName(column: Column | undefined): string {
  if (!column) throw new Error('Missing PostgreSQL column type');
  return `${escapeIdentifier(column.namespace)}.${escapeIdentifier(column.type)}`;
}
function cell(
  value: unknown,
  type: string | undefined,
  encoding: RestorePlan['encoding'],
): unknown {
  if (encoding === 'legacy' && (type === 'json' || type === 'jsonb') && value !== null)
    return JSON.stringify(value);
  return value;
}
export async function listBackups(
  importMetaUrl: string,
  options: { backupDir?: string } = {},
): Promise<string[]> {
  const directory =
    options.backupDir || join(await getProjectRoot(importMetaUrl), '.revealui', 'backups');
  try {
    return await completed(directory);
  } catch (error) {
    if (object(error).code === 'ENOENT') return [];
    throw error;
  }
}
