/** Mirrors Rust SystemStatus struct */
export interface SystemStatus {
  wsl_running: boolean
  distribution: string
  tier: string
  systemd_status: string
}

/** Mirrors Rust MountStatus struct */
export interface MountStatus {
  mounted: boolean
  mount_point: string
  device: string | null
  size_total: string | null
  size_used: string | null
  size_available: string | null
  use_percent: string | null
}

/** Mirrors Rust RepoInfo struct */
export interface RepoInfo {
  name: string
  c_path: string | null
  e_path: string | null
  identity: 'personal' | 'professional'
}

/** Mirrors Rust SyncResult struct */
export interface SyncResult {
  drive: string
  repo: string
  status: SyncStatus
  branch: string
}

export type SyncStatus = 'ok' | 'dirty' | 'diverged' | 'skip' | 'reset_failed' | 'error'

/** Mirrors Rust AppInfo struct */
export interface AppInfo {
  name: string
  display_name: string
  port: number
  url: string
}

/** Mirrors Rust AppStatus struct */
export interface AppStatus {
  app: AppInfo
  running: boolean
}

/** Mirrors Rust SetupStatus struct */
export interface SetupStatus {
  wsl_running: boolean
  nix_installed: boolean
  devbox_mounted: boolean
  git_name: string
  git_email: string
}

export type Page =
  | 'dashboard'
  | 'vault'
  | 'infrastructure'
  | 'sync'
  | 'tunnel'
  | 'terminal'
  | 'setup'

/** SSH connection parameters */
export interface SshConnectParams {
  host: string
  port: number
  username: string
  password: string
}

/** SSH output event from backend */
export interface SshOutputEvent {
  session_id: string
  data: string // base64-encoded
}

/** SSH disconnect event from backend */
export interface SshDisconnectEvent {
  session_id: string
  reason: string
}

/** Mirrors Rust SecretInfo struct from revvault-core */
export interface SecretInfo {
  path: string
  namespace: string
}

/** Mirrors Rust TailscaleStatus struct */
export interface TailscaleStatus {
  running: boolean
  ip: string | null
  hostname: string | null
  peers: TailscalePeer[]
}

/** Mirrors Rust TailscalePeer struct */
export interface TailscalePeer {
  hostname: string
  ip: string
  online: boolean
  os: string
}
