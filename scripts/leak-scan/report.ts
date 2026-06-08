import type { Finding } from './scan';

/** Human-readable: a `[LEAK:tag] file:line` header + an indented content line per finding. */
export function formatText(findings: readonly Finding[]): string {
  const out: string[] = [];
  for (const f of findings) {
    out.push(`[LEAK:${f.tag}] ${f.file}:${f.line} - ${f.reason}`);
    out.push(`  -> ${f.content}`);
  }
  return out.join('\n');
}

/** Machine-readable: `{ violations, entries }` — mirrors the legacy LEAK_JSON shape. */
export function formatJson(findings: readonly Finding[]): string {
  return JSON.stringify({ violations: findings.length, entries: findings });
}
