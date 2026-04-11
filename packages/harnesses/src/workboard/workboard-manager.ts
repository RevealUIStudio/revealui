import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { atomicWriteSync, lockPathFor, withLock, withLockAsync } from './file-lock.js';
import type {
  ConflictResult,
  WorkboardAgent,
  WorkboardState,
  WorkboardTask,
} from './workboard-protocol.js';

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
const STARTING_STALE_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Section name normalization (backward compat with v1 workboard)
// ---------------------------------------------------------------------------

const SECTION_MAP: Record<
  string,
  keyof Pick<WorkboardState, 'agents' | 'tasks' | 'blocked' | 'done' | 'log'> | null
> = {
  agents: 'agents',
  active_sessions: 'agents',
  sessions: 'agents',
  tasks: 'tasks',
  blocked: 'blocked',
  done: 'done',
  log: 'log',
  recent: 'log',
};

function normalizeSectionName(title: string): string | null {
  const key = title.toLowerCase().replace(/\s+/g, '_');
  return SECTION_MAP[key] || null;
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

function splitRow(line: string): string[] | null {
  if (!line.startsWith('|')) return null;
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^[-:]+$/.test(c));
}

function parseTable(lines: string[]): { columns: string[]; rows: Record<string, string>[] } {
  if (lines.length < 2) return { columns: [], rows: [] };

  const headerCells = splitRow(lines[0]!);
  if (!headerCells) return { columns: [], rows: [] };

  const sepCells = splitRow(lines[1]!);
  if (!(sepCells && isSeparatorRow(sepCells))) return { columns: [], rows: [] };

  const columns = headerCells.map((h) =>
    h
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, ''),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = splitRow(lines[i]!);
    if (!cells || isSeparatorRow(cells)) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < columns.length; j++) {
      const col = columns[j]!;
      const raw = (cells[j] || '').trim();
      row[col] = raw === ' - ' ? '' : raw;
    }
    rows.push(row);
  }

  return { columns, rows };
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function parseWorkboard(content: string): WorkboardState {
  const lines = content.split('\n');
  const rawSections: Array<{ title: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(/^##\s+(.+)/);
    if (m?.[1]) rawSections.push({ title: m[1].trim(), line: i });
  }

  const state: WorkboardState = {
    preamble: [],
    agents: [],
    tasks: [],
    blocked: [],
    done: [],
    log: [],
    _extra: {},
  };

  const firstLine = rawSections.length > 0 ? rawSections[0]?.line : lines.length;
  state.preamble = lines.slice(0, firstLine);

  for (let i = 0; i < rawSections.length; i++) {
    const sec = rawSections[i]!;
    const nextLine = i + 1 < rawSections.length ? rawSections[i + 1]?.line : lines.length;
    const body = lines.slice(sec.line + 1, nextLine);
    const normalized = normalizeSectionName(sec.title);

    if (
      normalized === 'agents' ||
      normalized === 'tasks' ||
      normalized === 'blocked' ||
      normalized === 'done'
    ) {
      const tableLines = body.filter((l) => l.startsWith('|'));
      if (tableLines.length >= 2) {
        const { rows } = parseTable(tableLines);
        (state[normalized] as unknown as Record<string, string>[]).length = 0;
        (state[normalized] as unknown as Record<string, string>[]).push(...rows);
      }
    } else if (normalized === 'log') {
      state.log = body.filter((l) => l.startsWith('- '));
    } else {
      state._extra[sec.title] = lines.slice(sec.line, nextLine).join('\n');
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

function padCell(value: string | undefined, width: number): string {
  const str = String(value || ' - ');
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function serializeTable(headers: string[], rows: Record<string, string>[]): string {
  if (headers.length === 0) return '(none)';

  const widths = headers.map((h) => {
    const dataMax = rows.reduce((max, row) => Math.max(max, String(row[h] || ' - ').length), 0);
    return Math.max(h.length, dataMax, 3);
  });

  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i]!)).join(' | ')} |`;
  const sepLine = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`;
  const dataLines = rows.map(
    (row) => `| ${headers.map((h, i) => padCell(row[h] || '', widths[i]!)).join(' | ')} |`,
  );

  return [headerLine, sepLine, ...dataLines].join('\n');
}

function serializeWorkboard(state: WorkboardState): string {
  const out: string[] = [];

  if (state.preamble.length > 0) {
    out.push(...state.preamble);
    if (state.preamble[state.preamble.length - 1] !== '') out.push('');
  }

  out.push('## Agents', '');
  out.push(
    serializeTable(
      ['id', 'env', 'started', 'task', 'files', 'updated'],
      state.agents as unknown as Record<string, string>[],
    ),
    '',
  );

  out.push('## Tasks', '');
  if (state.tasks.length > 0) {
    out.push(
      serializeTable(
        ['id', 'task', 'pri', 'status', 'owner', 'gh', 'updated', 'notes'],
        state.tasks as unknown as Record<string, string>[],
      ),
      '',
    );
  } else {
    out.push('(none)', '');
  }

  out.push('## Blocked', '');
  if (state.blocked.length > 0) {
    out.push(
      serializeTable(
        ['id', 'task', 'blocker', 'gh', 'notes'],
        state.blocked as unknown as Record<string, string>[],
      ),
      '',
    );
  } else {
    out.push('(none)', '');
  }

  out.push('## Done', '');
  if (state.done.length > 0) {
    out.push(
      serializeTable(
        ['id', 'task', 'owner', 'completed', 'gh', 'notes'],
        state.done as unknown as Record<string, string>[],
      ),
      '',
    );
  } else {
    out.push('(none)', '');
  }

  out.push('## Log', '');
  if (state.log.length > 0) out.push(...state.log);
  out.push('');

  for (const content of Object.values(state._extra)) {
    out.push(content, '');
  }

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// WorkboardManager
// ---------------------------------------------------------------------------

/**
 * WorkboardManager  -  reads, parses, and writes .claude/workboard.md (v2).
 *
 * Supports both v1 (Sessions/Recent) and v2 (Agents/Tasks/Blocked/Done/Log)
 * formats for backward compatibility. Always serializes to v2.
 *
 * All mutating methods use file locking (O_EXCL) to prevent race conditions.
 * Writes are atomic (tmp file + rename).
 */
export class WorkboardManager {
  private readonly lockPath: string;

  constructor(private readonly workboardPath: string) {
    const resolved = resolve(workboardPath);
    if (!resolved.endsWith('.md')) {
      throw new Error('Invalid workboard path: must be a .md file');
    }
    this.lockPath = lockPathFor(resolved);
  }

  // ---- Read/Write ----

  read(): WorkboardState {
    try {
      return parseWorkboard(readFileSync(this.workboardPath, 'utf8'));
    } catch {
      return emptyState();
    }
  }

  write(state: WorkboardState): void {
    withLock(this.lockPath, () => {
      atomicWriteSync(this.workboardPath, serializeWorkboard(state));
    });
  }

  async readAsync(): Promise<WorkboardState> {
    try {
      return parseWorkboard(await readFile(this.workboardPath, 'utf8'));
    } catch {
      return emptyState();
    }
  }

  async writeAsync(state: WorkboardState): Promise<void> {
    await withLockAsync(this.lockPath, async () => {
      atomicWriteSync(this.workboardPath, serializeWorkboard(state));
    });
  }

  // ---- Agent methods ----

  registerAgent(agent: WorkboardAgent): void {
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const idx = state.agents.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        state.agents[idx] = agent;
      } else {
        state.agents.push(agent);
      }
      this.writeUnlocked(state);
    });
  }

  unregisterAgent(id: string): void {
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      state.agents = state.agents.filter((a) => a.id !== id);
      this.writeUnlocked(state);
    });
  }

  updateAgent(id: string, updates: Partial<WorkboardAgent>): void {
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const idx = state.agents.findIndex((a) => a.id === id);
      if (idx < 0) return;
      state.agents[idx] = { ...state.agents[idx]!, ...updates };
      this.writeUnlocked(state);
    });
  }

  // ---- Task claiming ----

  /** Claim an available or partial task. Returns true on success. */
  claimTask(taskId: string, agentId: string): boolean {
    let success = false;
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status !== 'available' && task.status !== 'partial') return;
      task.status = 'claimed';
      task.owner = agentId;
      task.updated = new Date().toISOString().slice(0, 10);
      this.writeUnlocked(state);
      success = true;
    });
    return success;
  }

  /** Move a task from Tasks to Done. Returns true on success. */
  completeTask(taskId: string, agentId: string): boolean {
    let success = false;
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const idx = state.tasks.findIndex((t) => t.id === taskId);
      if (idx === -1) return;
      const task = state.tasks.splice(idx, 1)[0]!;
      state.done.unshift({
        id: task.id,
        task: task.task,
        owner: agentId || task.owner,
        completed: new Date().toISOString().slice(0, 10),
        gh: task.gh || '',
        notes: task.notes || '',
      });
      this.writeUnlocked(state);
      success = true;
    });
    return success;
  }

  /** Mark a claimed task as partial (agent stopped mid-work). */
  markPartial(taskId: string, notes: string): boolean {
    let success = false;
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      task.status = 'partial';
      task.updated = new Date().toISOString().slice(0, 10);
      if (notes) task.notes = notes;
      this.writeUnlocked(state);
      success = true;
    });
    return success;
  }

  /** Release a claimed/partial task back to available. */
  releaseTask(taskId: string): boolean {
    let success = false;
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      task.status = 'available';
      task.owner = '';
      task.updated = new Date().toISOString().slice(0, 10);
      this.writeUnlocked(state);
      success = true;
    });
    return success;
  }

  /** Move a blocked task to Tasks as available. */
  unblockTask(taskId: string, pri: string = 'P2'): boolean {
    let success = false;
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const idx = state.blocked.findIndex((t) => t.id === taskId);
      if (idx === -1) return;
      const blocked = state.blocked.splice(idx, 1)[0]!;
      state.tasks.push({
        id: blocked.id,
        task: blocked.task,
        pri: pri as WorkboardTask['pri'],
        status: 'available',
        owner: '',
        gh: blocked.gh || '',
        updated: new Date().toISOString().slice(0, 10),
        notes: blocked.notes || '',
      });
      this.writeUnlocked(state);
      success = true;
    });
    return success;
  }

  // ---- File claims ----

  claimFiles(id: string, files: string[]): void {
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const agent = state.agents.find((a) => a.id === id);
      if (!agent) return;
      agent.files = files.join(', ');
      agent.updated = `${new Date().toISOString().slice(0, 16)}Z`;
      this.writeUnlocked(state);
    });
  }

  releaseFiles(id: string): void {
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const agent = state.agents.find((a) => a.id === id);
      if (!agent) return;
      agent.files = '';
      agent.updated = `${new Date().toISOString().slice(0, 16)}Z`;
      this.writeUnlocked(state);
    });
  }

  // ---- Log ----

  addLogEntry(agentId: string, description: string): void {
    withLock(this.lockPath, () => {
      const state = this.readUnlocked();
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toISOString().slice(11, 16);
      state.log.unshift(`- [${dateStr} ${timeStr}] ${agentId}: ${description}`);
      if (state.log.length > 20) state.log.splice(20);
      this.writeUnlocked(state);
    });
  }

  // ---- Queries ----

  detectStale(): WorkboardAgent[] {
    const state = this.read();
    const now = Date.now();
    return state.agents.filter((a) => {
      try {
        const age = now - new Date(a.updated).getTime();
        const threshold = a.task === '(starting)' ? STARTING_STALE_MS : STALE_THRESHOLD_MS;
        return age > threshold;
      } catch {
        return false;
      }
    });
  }

  checkConflicts(mySessionId: string, files: string[]): ConflictResult {
    const state = this.read();
    const conflicts: ConflictResult['conflicts'] = [];

    for (const agent of state.agents) {
      if (agent.id === mySessionId) continue;
      const theirFiles = agent.files
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);
      const overlapping = files.filter((myFile) =>
        theirFiles.some(
          (theirFile) =>
            myFile === theirFile ||
            myFile.startsWith(theirFile.replace('**', '')) ||
            theirFile.startsWith(myFile.replace('**', '')),
        ),
      );
      if (overlapping.length > 0) {
        conflicts.push({
          thisSession: mySessionId,
          otherSession: agent.id,
          overlappingFiles: overlapping,
        });
      }
    }

    return { clean: conflicts.length === 0, conflicts };
  }

  getClaimedTasks(agentId: string): WorkboardTask[] {
    const state = this.read();
    return state.tasks.filter(
      (t) => t.status === 'claimed' && t.owner === agentId,
    ) as WorkboardTask[];
  }

  // ---- Internal ----

  private readUnlocked(): WorkboardState {
    try {
      return parseWorkboard(readFileSync(this.workboardPath, 'utf8'));
    } catch {
      return emptyState();
    }
  }

  private writeUnlocked(state: WorkboardState): void {
    atomicWriteSync(this.workboardPath, serializeWorkboard(state));
  }
}

function emptyState(): WorkboardState {
  return { preamble: [], agents: [], tasks: [], blocked: [], done: [], log: [], _extra: {} };
}

// Re-export for backward compat
/** @deprecated Use registerAgent instead */
export const registerSession = WorkboardManager.prototype.registerAgent;
/** @deprecated Use unregisterAgent instead */
export const unregisterSession = WorkboardManager.prototype.unregisterAgent;
