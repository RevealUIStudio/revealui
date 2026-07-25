/**
 * Hotfix → durable conversion registry (RevealUI control layer).
 *
 * Long-term durable solutions only. A registry entry is admitted debt, not a
 * preferred workflow. Prefer root-cause fixes in the owning primitive.
 */

export type HotfixStatus = 'pending' | 'resolved';

export interface HotfixEntry {
  id: string;
  title: string;
  symptom: string;
  temporary: string;
  durable: string;
  paths: string[];
  repo: string | null;
  gap: string | null;
  pr: string | null;
  session: string;
  created: string;
  status: HotfixStatus;
  resolved: string | null;
  resolveNote: string | null;
}

export interface HotfixManifest {
  version: 1;
  /** Control-layer store path this manifest was last written to. */
  store?: string;
  entries: HotfixEntry[];
}

export interface RegisterHotfixInput {
  title: string;
  symptom: string;
  temporary: string;
  durable: string;
  paths?: string[];
  repo?: string | null;
  gap?: string | null;
  id?: string;
}

export interface ResolveHotfixInput {
  pr?: string;
  note?: string;
}

export interface AuditHit {
  file: string;
  line: number;
  text: string;
  id: string | null;
}

export interface AuditReport {
  root: string;
  pending: HotfixEntry[];
  total: number;
  markers: AuditHit[];
  unregisteredCount: number;
  recentCommits: string[];
}
