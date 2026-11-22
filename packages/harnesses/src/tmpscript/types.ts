/** Registry records work and evidence. It never executes or deletes artifacts. */
export type TmpscriptStatus = 'pending' | 'confirmed' | 'held';
export interface ArtifactIdentity {
  dev: string;
  ino: string;
  mode: string;
  uid: string;
  nlink: string;
  size: string;
  mtimeNs: string;
  ctimeNs: string;
  sha256: string;
}
export interface TmpscriptEntry {
  id: string;
  path: string;
  purpose: string;
  /** Historical text only. Never executed or printed by the CLI. */
  validate: string | null;
  session: string;
  created: string;
  status: TmpscriptStatus;
  confirmed: string | null;
  sweptAsExpired?: boolean;
  artifactClass: 'helper' | 'source' | 'data' | 'unknown';
  owner: { tool: string; session: string };
  sensitivity: 'public' | 'confidential' | 'unknown';
  disposition: 'retain';
  consumers: Array<{ reference: string; state: 'active' | 'released' | 'unknown' }>;
  lease: 'active' | 'released' | 'unknown';
  identity: ArtifactIdentity | null;
  completion: { kind: 'sha256'; sha256: string; evidence: string; recordedAt: string } | null;
  preservation: { path: string; sha256: string; sourceSha256: string; verifiedAt: string } | null;
}
export interface TmpscriptManifest {
  version: 2;
  revision: number;
  store: string;
  entries: TmpscriptEntry[];
  /** Read-only legacy view. Mutations require explicit import first. */
  importRequired?: { path: string; sha256: string };
}
export interface RegisterTmpscriptInput {
  path: string;
  purpose?: string;
  /** Rejected when nonempty; retained only to fail old clients explicitly. */
  validate?: string | null;
  id?: string;
  artifactClass?: TmpscriptEntry['artifactClass'];
  owner?: TmpscriptEntry['owner'];
  sensitivity?: TmpscriptEntry['sensitivity'];
  consumers?: TmpscriptEntry['consumers'];
}
export interface TmpscriptStoreOptions {
  controlPath?: string;
  legacyPath?: string;
  previousPath?: string;
}
export interface ConfirmTmpscriptOptions extends TmpscriptStoreOptions {
  expectedSha256?: string;
  evidence?: string;
}
export interface SweepTmpscriptResult {
  removedFiles: 0;
  prunedEntries: 0;
  remaining: number;
  candidates: Array<{ id: string; reason: string }>;
}
