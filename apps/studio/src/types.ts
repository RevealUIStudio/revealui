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
  | 'vault'
  | 'infrastructure'
  | 'sync'
  | 'tunnel'
  | 'terminal'
  | 'git'
  | 'editor'
  | 'agent'
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
  vercelProjects: { api: string; cms: string; marketing: string };
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
  emailProvider: 'resend' | 'smtp';
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
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
