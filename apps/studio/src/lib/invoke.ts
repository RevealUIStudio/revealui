import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import type { MountStatus, SyncResult, SystemStatus } from '../types'

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
