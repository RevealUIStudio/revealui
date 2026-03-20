/** Mirrors Rust SystemStatus struct */
export interface SystemStatus {
  wsl_running: boolean;
  distribution: string;
  tier: string;
  systemd_status: string;
}

/** Mirrors Rust MountStatus struct */
export interface MountStatus {
  mounted: boolean;
  mount_point: string;
  device: string | null;
  size_total: string | null;
  size_used: string | null;
  size_available: string | null;
  use_percent: string | null;
}

/** Mirrors Rust RepoInfo struct */
export interface RepoInfo {
  name: string;
  c_path: string | null;
  e_path: string | null;
  identity: 'personal' | 'professional';
}

/** Mirrors Rust SyncResult struct */
export interface SyncResult {
  drive: string;
  repo: string;
  status: SyncStatus;
  branch: string;
}

export type SyncStatus = 'ok' | 'dirty' | 'diverged' | 'skip' | 'reset_failed' | 'error';

/** Mirrors Rust AppInfo struct */
export interface AppInfo {
  name: string;
  display_name: string;
  port: number;
  url: string;
}

/** Mirrors Rust AppStatus struct */
export interface AppStatus {
  app: AppInfo;
  running: boolean;
}

/** Mirrors Rust SetupStatus struct */
export interface SetupStatus {
  wsl_running: boolean;
  nix_installed: boolean;
  devbox_mounted: boolean;
  git_name: string;
  git_email: string;
}

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

/** SSH authentication — password or key file */
export type SshAuth =
  | { method: 'password'; password: string }
  | { method: 'key'; key_path: string; passphrase?: string | null };

/** SSH connection parameters */
export interface SshConnectParams {
  host: string;
  port: number;
  username: string;
  auth: SshAuth;
}

/** SSH output event from backend */
export interface SshOutputEvent {
  session_id: string;
  data: string; // base64-encoded
}

/** SSH disconnect event from backend */
export interface SshDisconnectEvent {
  session_id: string;
  reason: string;
}

/** Local shell output event from backend */
export interface ShellOutputEvent {
  session_id: string;
  data: string; // base64-encoded
}

/** Local shell exit event from backend */
export interface ShellExitEvent {
  session_id: string;
  reason: string;
}

/** Saved SSH connection profile — never stores passwords */
export interface SshBookmark {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  auth_method: 'password' | 'key';
  key_path?: string | null;
}

/** SSH host key verification event from backend */
export interface SshHostKeyEvent {
  host: string;
  port: number;
  fingerprint: string;
  key_type: string;
  /** "new" = TOFU (added to known_hosts), "match" = verified, "mismatch" = REJECTED */
  status: 'new' | 'match' | 'mismatch';
}

/** Mirrors Rust SecretInfo struct from revvault-core */
export interface SecretInfo {
  path: string;
  namespace: string;
}

// ── Git Panel ─────────────────────────────────────────────────────────────

/** One of: "modified" | "new" | "deleted" | "renamed" | "untracked" | "conflicted" */
export type GitFileStatusKind =
  | 'modified'
  | 'new'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted';

/** Mirrors Rust GitFileEntry struct */
export interface GitFileEntry {
  path: string;
  status: GitFileStatusKind;
}

/** Mirrors Rust GitStatusResult struct */
export interface GitStatusResult {
  branch: string;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
}

// ── Branch management ─────────────────────────────────────────────────────

/** Mirrors Rust GitBranch struct */
export interface GitBranch {
  name: string;
  is_current: boolean;
}

/** Mirrors Rust GitPushResult struct */
export interface GitPushResult {
  success: boolean;
  message: string;
}

/** Mirrors Rust GitPullResult struct */
export interface GitPullResult {
  success: boolean;
  message: string;
}

/** Mirrors Rust GitDiffContent struct — both file versions for a side-by-side diff viewer */
export interface GitDiffContent {
  original: string;
  modified: string;
}

/** Mirrors Rust GitCommitInfo struct */
export interface GitCommitInfo {
  sha: string;
  short_sha: string;
  message: string;
  author: string;
  timestamp: number; // Unix seconds
}

// ── Agent Panel ───────────────────────────────────────────────────────────────

/** One active row from the workboard.md Active Sessions table */
export interface AgentSession {
  id: string;
  env: string;
  started: string;
  task: string;
  files: string;
  updated: string;
}

/** Mirrors Rust TailscaleStatus struct */
export interface TailscaleStatus {
  running: boolean;
  ip: string | null;
  hostname: string | null;
  peers: TailscalePeer[];
}

/** Mirrors Rust TailscalePeer struct */
export interface TailscalePeer {
  hostname: string;
  ip: string;
  online: boolean;
  os: string;
}

/** Persistent config — mirrors Rust StudioConfig */
export interface StudioConfig {
  intent: 'deploy' | 'develop' | null;
  setupComplete: boolean;
  completedSteps: string[];
  deploy?: DeployConfig;
  develop?: DevelopConfig;
}

export interface DeployConfig {
  vercelTeamId?: string;
  domain?: string;
  apps?: { api?: string; cms?: string; marketing?: string };
  neonProjectId?: string;
  supabaseEnabled: boolean;
  emailProvider?: 'resend' | 'smtp';
}

export interface DevelopConfig {
  repoPath?: string;
  wslDistro?: string;
  nixInstalled: boolean;
}

/** Vercel API types */
export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  accountId?: string;
}

/** Mirrors Rust VercelDeployment struct (Vercel API response) */
export interface VercelDeployment {
  uid: string;
  url: string | null;
  state: string | null;
  created: number | null;
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

/** Health check result */
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
