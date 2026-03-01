import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import type {
  AppStatus,
  MountStatus,
  SecretInfo,
  SetupStatus,
  SyncResult,
  SystemStatus,
  TailscaleStatus,
} from '../types'

/** Typed wrappers around Tauri invoke calls */

export function getSystemStatus(): Promise<SystemStatus> {
  return tauriInvoke<SystemStatus>('get_system_status')
}

export function getMountStatus(): Promise<MountStatus> {
  return tauriInvoke<MountStatus>('get_mount_status')
}

export function mountDevbox(): Promise<string> {
  return tauriInvoke<string>('mount_devbox')
}

export function unmountDevbox(): Promise<string> {
  return tauriInvoke<string>('unmount_devbox')
}

export function syncAllRepos(): Promise<SyncResult[]> {
  return tauriInvoke<SyncResult[]>('sync_all_repos')
}

export function syncRepo(name: string): Promise<SyncResult> {
  return tauriInvoke<SyncResult>('sync_repo', { name })
}

export function listApps(): Promise<AppStatus[]> {
  return tauriInvoke<AppStatus[]>('list_apps')
}

export function startApp(name: string): Promise<string> {
  return tauriInvoke<string>('start_app', { name })
}

export function stopApp(name: string): Promise<string> {
  return tauriInvoke<string>('stop_app', { name })
}

export function checkSetup(): Promise<SetupStatus> {
  return tauriInvoke<SetupStatus>('check_setup')
}

export function setGitIdentity(name: string, email: string): Promise<void> {
  return tauriInvoke<void>('set_git_identity', { name, email })
}

// ── Vault ──────────────────────────────────────────────────────────────────

export function vaultInit(): Promise<void> {
  return tauriInvoke<void>('vault_init')
}

export function vaultIsInitialized(): Promise<boolean> {
  return tauriInvoke<boolean>('vault_is_initialized')
}

export function vaultList(prefix?: string): Promise<SecretInfo[]> {
  return tauriInvoke<SecretInfo[]>('vault_list', { prefix: prefix ?? null })
}

export function vaultGet(path: string): Promise<string> {
  return tauriInvoke<string>('vault_get', { path })
}

export function vaultSet(path: string, value: string, force: boolean): Promise<void> {
  return tauriInvoke<void>('vault_set', { path, value, force })
}

export function vaultDelete(path: string): Promise<void> {
  return tauriInvoke<void>('vault_delete', { path })
}

export function vaultSearch(query: string): Promise<SecretInfo[]> {
  return tauriInvoke<SecretInfo[]>('vault_search', { query })
}

export function vaultCopy(value: string): Promise<void> {
  return tauriInvoke<void>('vault_copy', { value })
}

// ── Tunnel ─────────────────────────────────────────────────────────────────

export function getTailscaleStatus(): Promise<TailscaleStatus> {
  return tauriInvoke<TailscaleStatus>('get_tailscale_status')
}

export function tailscaleUp(): Promise<string> {
  return tauriInvoke<string>('tailscale_up')
}

export function tailscaleDown(): Promise<string> {
  return tauriInvoke<string>('tailscale_down')
}
