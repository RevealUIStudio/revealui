import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type {
  AppStatus,
  MountStatus,
  SecretInfo,
  SetupStatus,
  SshBookmark,
  SshConnectParams,
  SyncResult,
  SystemStatus,
  TailscaleStatus,
} from '../types';

/** True when running inside the Tauri webview (IPC bridge available) */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ── Browser-mode mock data (used when Tauri IPC is unavailable) ───────────

const MOCK_DATA: Record<string, unknown> = {
  get_system_status: {
    wsl_running: true,
    distribution: 'Ubuntu-24.04 (mock)',
    tier: 'pro',
    systemd_status: 'running',
  } satisfies SystemStatus,
  get_mount_status: {
    mounted: false,
    mount_point: '/mnt/wsl-dev',
    device: null,
    size_total: null,
    size_used: null,
    size_available: null,
    use_percent: null,
  } satisfies MountStatus,
  check_setup: {
    wsl_running: true,
    nix_installed: true,
    devbox_mounted: false,
    git_name: 'RevealUI Studio',
    git_email: 'noreply@revealui.com',
  } satisfies SetupStatus,
  list_apps: [
    {
      app: { name: 'api', display_name: 'API', port: 3004, url: 'http://localhost:3004' },
      running: false,
    },
    {
      app: { name: 'cms', display_name: 'CMS', port: 4000, url: 'http://localhost:4000' },
      running: false,
    },
    {
      app: { name: 'docs', display_name: 'Docs', port: 3002, url: 'http://localhost:3002' },
      running: false,
    },
    {
      app: {
        name: 'marketing',
        display_name: 'Marketing',
        port: 3000,
        url: 'http://localhost:3000',
      },
      running: false,
    },
  ] satisfies AppStatus[],
  sync_all_repos: [] satisfies SyncResult[],
  get_tailscale_status: {
    running: false,
    ip: null,
    hostname: null,
    peers: [],
  } satisfies TailscaleStatus,
  vault_is_initialized: true,
  vault_list: [
    { path: 'stripe/secret_key', namespace: 'stripe' },
    { path: 'neon/database_url', namespace: 'neon' },
    { path: 'supabase/anon_key', namespace: 'supabase' },
  ] satisfies SecretInfo[],
  vault_search: [] satisfies SecretInfo[],
  vault_get: '••••••••',
  // Void / string commands return simple defaults
  mount_devbox: 'Mounted (mock)',
  unmount_devbox: 'Unmounted (mock)',
  start_app: 'Started (mock)',
  stop_app: 'Stopped (mock)',
  tailscale_up: 'Connected (mock)',
  tailscale_down: 'Disconnected (mock)',
  ssh_connect: 'mock-session-id',
  set_git_identity: undefined,
  vault_init: undefined,
  vault_set: undefined,
  vault_delete: undefined,
  vault_copy: undefined,
  ssh_disconnect: undefined,
  ssh_send: undefined,
  ssh_resize: undefined,
  sync_repo: { drive: 'C', repo: 'RevealUI', status: 'ok', branch: 'main' } satisfies SyncResult,
  read_app_log: '[mock] No log output available',
  ssh_bookmark_list: [] satisfies SshBookmark[],
  ssh_bookmark_save: undefined,
  ssh_bookmark_delete: undefined,
};

/** Guarded invoke — returns mock data in browser, real IPC in Tauri */
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    if (cmd in MOCK_DATA) {
      return Promise.resolve(MOCK_DATA[cmd] as T);
    }
    return Promise.reject(new Error(`No mock data for command: ${cmd}`));
  }
  return tauriInvoke<T>(cmd, args);
}

/** Typed wrappers around Tauri invoke calls */

export function getSystemStatus(): Promise<SystemStatus> {
  return invoke<SystemStatus>('get_system_status');
}

export function getMountStatus(): Promise<MountStatus> {
  return invoke<MountStatus>('get_mount_status');
}

export function mountDevbox(): Promise<string> {
  return invoke<string>('mount_devbox');
}

export function unmountDevbox(): Promise<string> {
  return invoke<string>('unmount_devbox');
}

export function syncAllRepos(): Promise<SyncResult[]> {
  return invoke<SyncResult[]>('sync_all_repos');
}

export function syncRepo(name: string): Promise<SyncResult> {
  return invoke<SyncResult>('sync_repo', { name });
}

export function listApps(): Promise<AppStatus[]> {
  return invoke<AppStatus[]>('list_apps');
}

export function startApp(name: string): Promise<string> {
  return invoke<string>('start_app', { name });
}

export function stopApp(name: string): Promise<string> {
  return invoke<string>('stop_app', { name });
}

export function readAppLog(name: string, lines?: number): Promise<string> {
  return invoke<string>('read_app_log', { name, lines: lines ?? null });
}

export function checkSetup(): Promise<SetupStatus> {
  return invoke<SetupStatus>('check_setup');
}

export function setGitIdentity(name: string, email: string): Promise<void> {
  return invoke<void>('set_git_identity', { name, email });
}

// ── Vault ──────────────────────────────────────────────────────────────────

export function vaultInit(): Promise<void> {
  return invoke<void>('vault_init');
}

export function vaultIsInitialized(): Promise<boolean> {
  return invoke<boolean>('vault_is_initialized');
}

export function vaultList(prefix?: string): Promise<SecretInfo[]> {
  return invoke<SecretInfo[]>('vault_list', { prefix: prefix ?? null });
}

export function vaultGet(path: string): Promise<string> {
  return invoke<string>('vault_get', { path });
}

export function vaultSet(path: string, value: string, force: boolean): Promise<void> {
  return invoke<void>('vault_set', { path, value, force });
}

export function vaultDelete(path: string): Promise<void> {
  return invoke<void>('vault_delete', { path });
}

export function vaultSearch(query: string): Promise<SecretInfo[]> {
  return invoke<SecretInfo[]>('vault_search', { query });
}

export function vaultCopy(value: string): Promise<void> {
  return invoke<void>('vault_copy', { value });
}

// ── Tunnel ─────────────────────────────────────────────────────────────────

export function getTailscaleStatus(): Promise<TailscaleStatus> {
  return invoke<TailscaleStatus>('get_tailscale_status');
}

export function tailscaleUp(): Promise<string> {
  return invoke<string>('tailscale_up');
}

export function tailscaleDown(): Promise<string> {
  return invoke<string>('tailscale_down');
}

// ── SSH Terminal ──────────────────────────────────────────────────────────────

export function sshConnect(params: SshConnectParams): Promise<string> {
  return invoke<string>('ssh_connect', { ...params });
}

export function sshDisconnect(sessionId: string): Promise<void> {
  return invoke<void>('ssh_disconnect', { sessionId });
}

export function sshSend(sessionId: string, data: string): Promise<void> {
  return invoke<void>('ssh_send', { sessionId, data });
}

export function sshResize(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke<void>('ssh_resize', { sessionId, cols, rows });
}

// ── SSH Bookmarks ────────────────────────────────────────────────────────────

export function sshBookmarkList(): Promise<SshBookmark[]> {
  return invoke<SshBookmark[]>('ssh_bookmark_list');
}

export function sshBookmarkSave(bookmark: SshBookmark): Promise<void> {
  return invoke<void>('ssh_bookmark_save', { bookmark });
}

export function sshBookmarkDelete(id: string): Promise<void> {
  return invoke<void>('ssh_bookmark_delete', { id });
}
