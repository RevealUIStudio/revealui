import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { controlManifestPath } from './paths.js';
import { loadManifest, saveManifest } from './store.js';
import type {
  AuditHit,
  AuditReport,
  HotfixEntry,
  HotfixManifest,
  RegisterHotfixInput,
  ResolveHotfixInput,
} from './types.js';

/** Days after which a still-pending entry is overdue. */
export const OVERDUE_DAYS = 7;
export const ENTRY_RETENTION_DAYS = 90;

const MARKER_PATTERNS = [
  /HOTFIX\(([A-Za-z0-9._:-]+)\)/,
  /HOTFIX:\s*(.+)$/,
  /FIXME\(durable\)/,
  /@hotfix\b/,
];

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
  '.yml',
  '.yaml',
  '.sh',
  '.toml',
]);

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  '.next',
  'coverage',
  'opensrc',
  '.direnv',
  '.pgdata',
  'vendor',
]);

export function ageDays(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 86400000;
}

export function findEntry(m: HotfixManifest, key: string): HotfixEntry | undefined {
  return m.entries.find((e) => e.id === key || e.title === key);
}

export function slugify(title: string): string {
  return (
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'hotfix'
  );
}

export function pendingEntries(m?: HotfixManifest): HotfixEntry[] {
  const manifest = m ?? loadManifest();
  return manifest.entries.filter((e) => e.status === 'pending');
}

/**
 * Register admitted debt. Prefer durable root-cause fixes instead of calling
 * this — registration is not success; conversion is.
 */
export function registerHotfix(
  input: RegisterHotfixInput,
  options?: { controlPath?: string; legacyPath?: string },
): HotfixEntry {
  if (!input.title?.trim()) {
    throw new Error('hotfix: register requires --title');
  }
  if (!input.symptom?.trim() || !input.temporary?.trim() || !input.durable?.trim()) {
    throw new Error('hotfix: register requires --symptom, --temporary, and --durable');
  }

  const m = loadManifest(options);
  const id = input.id?.trim() || `${slugify(input.title)}-${Date.now().toString(36)}`;
  if (findEntry(m, id)) {
    throw new Error(`hotfix: id already exists: ${id}`);
  }

  const entry: HotfixEntry = {
    id,
    title: input.title.trim(),
    symptom: input.symptom.trim(),
    temporary: input.temporary.trim(),
    durable: input.durable.trim(),
    paths: input.paths ?? [],
    repo: input.repo ?? null,
    gap: input.gap ?? null,
    pr: null,
    session: String(process.ppid || 0),
    created: new Date().toISOString(),
    status: 'pending',
    resolved: null,
    resolveNote: null,
  };
  m.entries.push(entry);
  saveManifest(m, options);
  return entry;
}

export function resolveHotfix(
  key: string,
  input: ResolveHotfixInput,
  options?: { controlPath?: string; legacyPath?: string },
): HotfixEntry {
  const m = loadManifest(options);
  const e = findEntry(m, key);
  if (!e) throw new Error(`hotfix: no entry for: ${key}`);
  if (e.status === 'resolved') return e;
  if (!input.pr && !input.note) {
    throw new Error('hotfix: resolve requires --pr <url> and/or --note <text>');
  }
  e.status = 'resolved';
  e.resolved = new Date().toISOString();
  e.pr = input.pr || e.pr;
  e.resolveNote = input.note || null;
  saveManifest(m, options);
  return e;
}

export function promoteHotfix(
  key: string,
  gap: string,
  options?: { controlPath?: string; legacyPath?: string },
): HotfixEntry {
  if (!gap?.trim()) throw new Error('hotfix: promote requires --gap GAP-NNN');
  const m = loadManifest(options);
  const e = findEntry(m, key);
  if (!e) throw new Error(`hotfix: no entry for: ${key}`);
  e.gap = gap.trim();
  saveManifest(m, options);
  return e;
}

export function sweepResolved(options?: { controlPath?: string; legacyPath?: string }): {
  pruned: number;
  remaining: number;
} {
  const m = loadManifest(options);
  const before = m.entries.length;
  m.entries = m.entries.filter((e) => {
    if (e.status !== 'resolved' || !e.resolved) return true;
    return ageDays(e.resolved) <= ENTRY_RETENTION_DAYS;
  });
  saveManifest(m, options);
  return { pruned: before - m.entries.length, remaining: m.entries.length };
}

function walkFiles(root: string, out: string[], depth: number): void {
  if (depth > 12) return;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      if (ent.name.startsWith('.') && ent.name !== '.claude' && ent.name !== '.jv') continue;
      walkFiles(join(root, ent.name), out, depth + 1);
      continue;
    }
    if (!SCAN_EXTENSIONS.has(extname(ent.name))) continue;
    out.push(join(root, ent.name));
  }
}

function scanFile(filePath: string): AuditHit[] {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  if (text.length > 1_500_000) return [];
  const hits: AuditHit[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.includes('HOTFIX') && !line.includes('FIXME(durable)') && !line.includes('@hotfix')) {
      continue;
    }
    for (const re of MARKER_PATTERNS) {
      const m = line.match(re);
      if (m) {
        hits.push({
          file: filePath,
          line: i + 1,
          text: line.trim().slice(0, 200),
          id: m[1] && !m[1].includes(' ') ? m[1] : null,
        });
        break;
      }
    }
  }
  return hits;
}

export function auditHotfixes(
  rootArg?: string,
  options?: { controlPath?: string; legacyPath?: string },
): AuditReport {
  const root = resolve(rootArg || process.cwd());
  const m = loadManifest(options);
  const pending = m.entries.filter((e) => e.status === 'pending');
  const byId = new Map(m.entries.map((e) => [e.id, e]));

  const files: string[] = [];
  walkFiles(root, files, 0);
  const markers: AuditHit[] = [];
  for (const f of files) {
    for (const h of scanFile(f)) markers.push(h);
  }

  let unregisteredCount = 0;
  for (const h of markers) {
    if (!(h.id && byId.has(h.id))) unregisteredCount++;
  }

  let recentCommits: string[] = [];
  try {
    const out = execFileSync(
      'git',
      ['-C', root, 'log', '--oneline', '-30', '--grep=hotfix', '-i'],
      { encoding: 'utf8', timeout: 3000 },
    ).trim();
    if (out) recentCommits = out.split('\n').slice(0, 10);
  } catch {
    /* not a git repo */
  }

  return {
    root,
    pending,
    total: m.entries.length,
    markers,
    unregisteredCount,
    recentCommits,
  };
}

/** Format session-boundary check (warn-only; always informational). */
export function formatCheckLines(m?: HotfixManifest): string[] {
  const pending = pendingEntries(m);
  if (pending.length === 0) return [];
  const overdue = pending.filter((e) => ageDays(e.created) > OVERDUE_DAYS);
  const lines: string[] = [
    `[hotfix] ${pending.length} hotfix(es) awaiting durable conversion` +
      (overdue.length ? ` (${overdue.length} overdue >${OVERDUE_DAYS}d)` : '') +
      ':',
  ];
  for (const e of pending) {
    const days = ageDays(e.created).toFixed(1);
    const flag = ageDays(e.created) > OVERDUE_DAYS ? ' OVERDUE' : '';
    lines.push(`  ${e.id}${flag} — ${e.title} — ${days}d`);
    lines.push(`    temporary: ${e.temporary}`);
    lines.push(`    durable:   ${e.durable}`);
    if (e.gap) lines.push(`    gap:       ${e.gap}`);
    lines.push(`    → revealui-harnesses hotfix resolve ${e.id} --pr <url>`);
  }
  lines.push(
    '[hotfix] hardline: long-term durable solutions only (RevealUI control layer / durable-solutions)',
  );
  lines.push(`[hotfix] store: ${controlManifestPath()}`);
  return lines;
}

export function formatAuditReport(report: AuditReport): string[] {
  const lines: string[] = [
    `[hotfix audit] root=${report.root}`,
    `[hotfix audit] registry: ${report.pending.length} pending / ${report.total} total`,
    `[hotfix audit] store: ${controlManifestPath()}`,
  ];
  for (const e of report.pending) {
    const days = ageDays(e.created).toFixed(1);
    const over = ageDays(e.created) > OVERDUE_DAYS ? ' OVERDUE' : '';
    lines.push(`  pending${over} ${e.id} (${days}d) — ${e.title}`);
    lines.push(`    → durable: ${e.durable}`);
  }
  lines.push(`[hotfix audit] markers found: ${report.markers.length}`);
  const byId = new Map(loadManifest().entries.map((e) => [e.id, e] as const));
  for (const h of report.markers) {
    const rel = relative(report.root, h.file) || h.file;
    if (h.id && byId.has(h.id)) {
      const e = byId.get(h.id);
      lines.push(`  marked  ${rel}:${h.line}  id=${h.id}  status=${e?.status}`);
    } else if (h.id) {
      lines.push(`  ORPHAN  ${rel}:${h.line}  id=${h.id} (not in registry)`);
      lines.push(`    ${h.text}`);
    } else {
      lines.push(`  MARKER  ${rel}:${h.line}`);
      lines.push(`    ${h.text}`);
      lines.push(
        '    → prefer a durable root-cause fix; if unavoidable: revealui-harnesses hotfix register …',
      );
    }
  }
  if (report.recentCommits.length > 0) {
    lines.push('[hotfix audit] recent commits matching /hotfix/i:');
    for (const line of report.recentCommits) lines.push(`  ${line}`);
  }
  if (report.pending.length === 0 && report.markers.length === 0) {
    lines.push('[hotfix audit] clean — no pending debt, no markers');
  } else if (report.unregisteredCount > 0) {
    lines.push(`[hotfix audit] ${report.unregisteredCount} marker(s) need register or id link`);
  }
  lines.push('[hotfix audit] hardline: long-term durable solutions only (control layer)');
  return lines;
}
