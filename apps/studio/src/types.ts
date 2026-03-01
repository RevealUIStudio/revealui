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

export type Page = 'dashboard' | 'devbox' | 'sync' | 'apps'
