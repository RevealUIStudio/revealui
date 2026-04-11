// Auto-generated types are in ./generated/ — do not manually edit those files.
// To regenerate: bash apps/studio/scripts/generate-types.sh

// ── Re-exports from generated Rust bindings (ts-rs) ─────────────────────────

export type { AppInfo } from './generated/AppInfo';
export type { AppStatus } from './generated/AppStatus';
export type { DeployApps } from './generated/DeployApps';
export type { DeployConfig } from './generated/DeployConfig';
export type { DevelopConfig } from './generated/DevelopConfig';
export type { GitBranch } from './generated/GitBranch';
export type { GitCommitInfo } from './generated/GitCommitInfo';
export type { GitDiffContent } from './generated/GitDiffContent';
export type { GitFileEntry } from './generated/GitFileEntry';
export type { GitPullResult } from './generated/GitPullResult';
export type { GitPushResult } from './generated/GitPushResult';
export type { GitStatusResult } from './generated/GitStatusResult';
export type { MountStatus } from './generated/MountStatus';
export type { RepoInfo } from './generated/RepoInfo';
export type { SecretInfo } from './generated/SecretInfo';
export type { SetupStatus } from './generated/SetupStatus';
export type { ShellExitEvent } from './generated/ShellExitEvent';
export type { ShellOutputEvent } from './generated/ShellOutputEvent';
export type { SshAuth } from './generated/SshAuth';
export type { SshBookmark } from './generated/SshBookmark';
export type { SshDisconnectEvent } from './generated/SshDisconnectEvent';
export type { SshHostKeyEvent } from './generated/SshHostKeyEvent';
export type { SshOutputEvent } from './generated/SshOutputEvent';
export type { StudioConfig } from './generated/StudioConfig';
export type { SyncResult } from './generated/SyncResult';
export type { SystemStatus } from './generated/SystemStatus';
export type { TailscalePeer } from './generated/TailscalePeer';
export type { TailscaleStatus } from './generated/TailscaleStatus';
export type { VercelDeployment } from './generated/VercelDeployment';
export type { VercelProject } from './generated/VercelProject';

// ── TS-only types (no Rust mirror) ──────────────────────────────────────────

/** SyncResult.status is a plain string in Rust; this union narrows it on the TS side. */
export type SyncStatus = 'ok' | 'dirty' | 'diverged' | 'skip' | 'reset_failed' | 'error';

export type Page =
  | 'dashboard'
  | 'gallery'
  | 'vault'
  | 'infrastructure'
  | 'sync'
  | 'tunnel'
  | 'terminal'
  | 'git'
  | 'editor'
  | 'agent'
  | 'inference'
  | 'setup'
  | 'settings'
  | 'deploy';

/** SSH connection parameters */
export interface SshConnectParams {
  host: string;
  port: number;
  username: string;
  auth: import('./generated/SshAuth').SshAuth;
}

/** One of: "modified" | "new" | "deleted" | "renamed" | "untracked" | "conflicted" */
export type GitFileStatusKind =
  | 'modified'
  | 'new'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted';

// ── Agent Panel ─────────────────────────────────────────────────────────────

/** One active row from the workboard.md Active Sessions table */
export interface AgentSession {
  id: string;
  env: string;
  started: string;
  task: string;
  files: string;
  updated: string;
}

// ── Agent Spawner ──────────────────────────────────────────────────────────

/** Inference backend for spawned agents */
export type AgentBackend = 'Snap' | 'Ollama';

/** Snapshot of a spawned agent session */
export interface AgentSessionInfo {
  id: string;
  name: string;
  model: string;
  backend: AgentBackend;
  prompt: string;
  status: 'running' | 'stopped' | 'errored';
  pid: number | null;
}

/** Streamed output from an agent process */
export interface AgentOutputEvent {
  session_id: string;
  stream: 'stdout' | 'stderr' | 'pty';
  line: string;
}

/** Emitted when an agent process exits */
export interface AgentExitEvent {
  session_id: string;
  code: number | null;
}

// ── Harness Daemon (PGlite-backed coordination) ───────────────────────────

/** Active agent session from the harness daemon */
export interface HarnessSession {
  id: string;
  env: string;
  task: string;
  files: string | null;
  pid: number | null;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
  exit_summary: string | null;
}

/** Inter-agent message */
export interface HarnessMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
}

/** A task with CAS-based claiming */
export interface HarnessTask {
  id: string;
  description: string;
  status: 'open' | 'claimed' | 'completed';
  owner: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** File reservation (advisory lock) */
export interface HarnessReservation {
  file_path: string;
  agent_id: string;
  reserved_at: string;
  expires_at: string;
  reason: string;
}

/** Result of claiming a task */
export interface HarnessClaimResult {
  success: boolean;
  owner?: string;
}

/** Result of reserving a file */
export interface HarnessReserveResult {
  success: boolean;
  holder?: string;
}

// ── Local Inference ────────────────────────────────────────────────────────

/** Ollama server status */
export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
}

/** An Ollama model available locally */
export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

/** Result of pulling an Ollama model */
export interface ModelPullResult {
  success: boolean;
  message: string;
}

/** Canonical inference snap status */
export interface SnapStatus {
  installed: boolean;
  running: boolean;
  snap_name: string;
  endpoint: string | null;
  version: string | null;
}

/** An available inference snap model */
export interface SnapModel {
  name: string;
  description: string;
  installed: boolean;
}

/** A detected terminal emulator and its profile install status */
export interface TerminalProfile {
  id: string;
  name: string;
  platform: string;
  installed: boolean;
  config_file: string;
  dest_path: string;
}

/** Deploy wizard step IDs */
export type DeployStep =
  | 'vercel'
  | 'database'
  | 'stripe'
  | 'email'
  | 'blob'
  | 'secrets'
  | 'domain'
  | 'deploy'
  | 'verify';

/** Health check result (TS-only — Rust command returns u16 directly) */
export interface HealthCheckResult {
  url: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

/** Accumulated wizard data — survives across steps via parent state. */
export interface WizardData {
  vercelToken: string;
  vercelProjects: { api: string; admin: string; marketing: string };
  postgresUrl: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseSecretKey?: string;
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  stripePriceIds: { pro: string; max: string; enterprise: string };
  licensePrivateKey: string;
  licensePublicKey: string;
  emailProvider: 'gmail';
  googleServiceAccountEmail?: string;
  googlePrivateKey?: string;
  emailFrom?: string;
  blobToken: string;
  revealuiSecret: string;
  revealuiKek: string;
  cronSecret: string;
  domain: string;
  signupOpen: boolean;
  brandName?: string;
  signupWhitelist?: string;
  brandColor?: string;
  brandLogo?: string;
}
