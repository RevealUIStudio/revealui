import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const MOCK_COMMIT_RECENT_S = 300; // 5 minutes ago
const MOCK_COMMIT_OLDER_S = 3600; // 1 hour ago

import type {
  AgentBackend,
  AgentSession,
  AgentSessionInfo,
  AppStatus,
  BitNetStatus,
  GitBranch,
  GitCommitInfo,
  GitDiffContent,
  GitPullResult,
  GitPushResult,
  GitStatusResult,
  ModelPullResult,
  MountStatus,
  OllamaModel,
  OllamaStatus,
  SecretInfo,
  SetupStatus,
  SnapModel,
  SnapStatus,
  SshBookmark,
  SshConnectParams,
  StudioConfig,
  SyncResult,
  SystemStatus,
  TailscaleStatus,
  TerminalProfile,
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
  get_config: {
    intent: null,
    setupComplete: false,
    completedSteps: [],
  } satisfies StudioConfig,
  set_config: undefined,
  reset_config: undefined,
  shell_open: 'mock-shell-session-id',
  shell_close: undefined,
  shell_send: undefined,
  shell_resize: undefined,
  git_status: {
    branch: 'main',
    staged: [{ path: 'apps/studio/src/types.ts', status: 'modified' }],
    unstaged: [{ path: 'apps/api/src/index.ts', status: 'modified' }],
    untracked: [{ path: 'apps/studio/src/components/git/GitPanel.tsx', status: 'untracked' }],
  } satisfies GitStatusResult,
  git_diff_file:
    '--- a/apps/studio/src/types.ts\n+++ b/apps/studio/src/types.ts\n@@ -1,3 +1,6 @@\n /** Mirrors Rust SystemStatus struct */\n+\n+export type GitFileStatusKind = "modified" | "new";\n+\n export interface SystemStatus {\n',
  git_stage_file: undefined,
  git_unstage_file: undefined,
  git_discard_file: undefined,
  git_commit: 'abc1234def5678901234567890abcdef12345678',
  git_list_branches: [
    { name: 'main', is_current: true },
    { name: 'feat/shell-v1', is_current: false },
  ] satisfies GitBranch[],
  git_create_branch: undefined,
  git_switch_branch: undefined,
  git_delete_branch: undefined,
  git_push: { success: true, message: 'Everything up-to-date' } satisfies GitPushResult,
  git_pull: { success: true, message: 'Already up to date.' } satisfies GitPullResult,
  git_log: [
    {
      sha: 'abc1234def5678901234567890abcdef12345678',
      short_sha: 'abc1234',
      message: 'feat(studio): add CodeMirror editor + branch management',
      author: 'RevealUI Studio',
      timestamp: Math.floor(Date.now() / 1000) - MOCK_COMMIT_RECENT_S,
    },
    {
      sha: 'def5678901234567890abcdef12345678abc1234',
      short_sha: 'def5678',
      message: 'feat(studio): git panel MVP — status, diff, stage, commit',
      author: 'RevealUI Studio',
      timestamp: Math.floor(Date.now() / 1000) - MOCK_COMMIT_OLDER_S,
    },
  ] satisfies GitCommitInfo[],
  git_read_file: '// Mock file content\nexport default function example() {}\n',
  git_write_file: undefined,
  agent_spawn: 'mock-agent-session-id',
  agent_stop: undefined,
  agent_list: [] satisfies AgentSessionInfo[],
  agent_remove: undefined,
  inference_ollama_status: {
    installed: false,
    running: false,
    version: null,
  } satisfies OllamaStatus,
  inference_ollama_models: [] satisfies OllamaModel[],
  inference_ollama_pull: { success: true, message: 'Pulled (mock)' } satisfies ModelPullResult,
  inference_ollama_delete: undefined,
  inference_ollama_start: undefined,
  inference_ollama_stop: undefined,
  inference_bitnet_status: {
    installed: false,
    model_path: null,
  } satisfies BitNetStatus,
  inference_snap_status: {
    installed: false,
    running: false,
    snap_name: 'nemotron-3-nano',
    endpoint: null,
    version: null,
  } satisfies SnapStatus,
  inference_snap_list: [
    {
      name: 'nemotron-3-nano',
      description: 'General (reasoning + non-reasoning) — free tier default',
      installed: false,
    },
    {
      name: 'gemma3',
      description: 'General + vision — image understanding, multimodal',
      installed: false,
    },
    {
      name: 'deepseek-r1',
      description: 'Reasoning — complex analysis, chain-of-thought',
      installed: false,
    },
    {
      name: 'qwen-vl',
      description: 'Vision-language — document parsing, visual Q&A',
      installed: false,
    },
  ] satisfies SnapModel[],
  inference_snap_install: { success: true, message: 'Installed (mock)' } satisfies ModelPullResult,
  inference_snap_remove: undefined,
  agent_read_workboard: [
    '# RevealUI Workboard',
    '_Last updated: 2026-03-18T20:00Z_',
    '',
    '## Active Sessions',
    '',
    '| id | env | started | task | files | updated |',
    '|----|-----|---------|------|-------|---------|',
    '| wsl-root | wsl | 2026-03-18T16:31Z | Building agent session panel | apps/studio/src/components/agent/AgentPanel.tsx | 2026-03-18T20:25Z |',
    '| zed-extension | zed | 2026-03-18T15:00Z | idle | — | 2026-03-18T18:00Z |',
    '',
    '## Recent',
    '',
    '- [2026-03-18 18:00] wsl-root: Fixed settings-layout test failures',
    '- [2026-03-18 14:00] zed-extension: Biome lint cleanup',
  ].join('\n'),
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

// ── Local Shell ─────────────────────────────────────────────────────────────

export function shellOpen(cols: number, rows: number, cwd?: string): Promise<string> {
  return invoke<string>('shell_open', { cols, rows, cwd: cwd ?? null });
}

export function shellClose(sessionId: string): Promise<void> {
  return invoke<void>('shell_close', { sessionId });
}

export function shellSend(sessionId: string, data: string): Promise<void> {
  return invoke<void>('shell_send', { sessionId, data });
}

export function shellResize(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke<void>('shell_resize', { sessionId, cols, rows });
}

// ── Git Panel ─────────────────────────────────────────────────────────────

export function gitStatus(repoPath: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>('git_status', { repoPath });
}

export function gitDiffFile(repoPath: string, filePath: string, staged: boolean): Promise<string> {
  return invoke<string>('git_diff_file', { repoPath, filePath, staged });
}

export function gitDiffContent(
  repoPath: string,
  filePath: string,
  staged: boolean,
): Promise<GitDiffContent> {
  return invoke<GitDiffContent>('git_diff_content', { repoPath, filePath, staged });
}

export function gitStageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke<void>('git_stage_file', { repoPath, filePath });
}

export function gitUnstageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke<void>('git_unstage_file', { repoPath, filePath });
}

export function gitDiscardFile(repoPath: string, filePath: string): Promise<void> {
  return invoke<void>('git_discard_file', { repoPath, filePath });
}

export function gitCommit(repoPath: string, message: string): Promise<string> {
  return invoke<string>('git_commit', { repoPath, message });
}

export function gitListBranches(repoPath: string): Promise<GitBranch[]> {
  return invoke<GitBranch[]>('git_list_branches', { repoPath });
}

export function gitCreateBranch(repoPath: string, name: string): Promise<void> {
  return invoke<void>('git_create_branch', { repoPath, name });
}

export function gitSwitchBranch(repoPath: string, name: string): Promise<void> {
  return invoke<void>('git_switch_branch', { repoPath, name });
}

export function gitDeleteBranch(repoPath: string, name: string): Promise<void> {
  return invoke<void>('git_delete_branch', { repoPath, name });
}

export function gitPush(repoPath: string, remote: string, branch: string): Promise<GitPushResult> {
  return invoke<GitPushResult>('git_push', { repoPath, remote, branch });
}

export function gitPull(repoPath: string, remote: string, branch: string): Promise<GitPullResult> {
  return invoke<GitPullResult>('git_pull', { repoPath, remote, branch });
}

export function gitLog(repoPath: string, limit?: number): Promise<GitCommitInfo[]> {
  return invoke<GitCommitInfo[]>('git_log', { repoPath, limit: limit ?? null });
}

export function gitReadFile(repoPath: string, filePath: string): Promise<string> {
  return invoke<string>('git_read_file', { repoPath, filePath });
}

export function gitWriteFile(repoPath: string, filePath: string, content: string): Promise<void> {
  return invoke<void>('git_write_file', { repoPath, filePath, content });
}

// ── Agent Panel ──────────────────────────────────────────────────────────────

export function agentReadWorkboard(path: string): Promise<string> {
  return invoke<string>('agent_read_workboard', { path });
}

// ── Agent Spawner ───────────────────────────────────────────────────────────

export function agentSpawn(
  name: string,
  backend: AgentBackend,
  model: string,
  prompt: string,
): Promise<string> {
  return invoke<string>('agent_spawn', { name, backend, model, prompt });
}

export function agentStop(sessionId: string): Promise<void> {
  return invoke<void>('agent_stop', { sessionId });
}

export function agentList(): Promise<AgentSessionInfo[]> {
  return invoke<AgentSessionInfo[]>('agent_list');
}

export function agentRemove(sessionId: string): Promise<void> {
  return invoke<void>('agent_remove', { sessionId });
}

// ── Local Inference ─────────────────────────────────────────────────────────

export function inferenceOllamaStatus(): Promise<OllamaStatus> {
  return invoke<OllamaStatus>('inference_ollama_status');
}

export function inferenceOllamaModels(): Promise<OllamaModel[]> {
  return invoke<OllamaModel[]>('inference_ollama_models');
}

export function inferenceOllamaPull(modelName: string): Promise<ModelPullResult> {
  return invoke<ModelPullResult>('inference_ollama_pull', { modelName });
}

export function inferenceOllamaDelete(modelName: string): Promise<void> {
  return invoke<void>('inference_ollama_delete', { modelName });
}

export function inferenceOllamaStart(): Promise<void> {
  return invoke<void>('inference_ollama_start');
}

export function inferenceOllamaStop(): Promise<void> {
  return invoke<void>('inference_ollama_stop');
}

export function inferenceBitnetStatus(): Promise<BitNetStatus> {
  return invoke<BitNetStatus>('inference_bitnet_status');
}

// ── Inference Snaps ─────────────────────────────────────────────────────────

export function inferenceSnapStatus(snapName: string): Promise<SnapStatus> {
  return invoke<SnapStatus>('inference_snap_status', { snapName });
}

export function inferenceSnapList(): Promise<SnapModel[]> {
  return invoke<SnapModel[]>('inference_snap_list');
}

export function inferenceSnapInstall(snapName: string): Promise<ModelPullResult> {
  return invoke<ModelPullResult>('inference_snap_install', { snapName });
}

export function inferenceSnapRemove(snapName: string): Promise<void> {
  return invoke<void>('inference_snap_remove', { snapName });
}

// ── Terminal profiles ────────────────────────────────────────────────────────

export function terminalDetect(): Promise<TerminalProfile[]> {
  if (!isTauri()) {
    return Promise.resolve([
      {
        id: 'alacritty',
        name: 'Alacritty',
        platform: 'Linux',
        installed: false,
        config_file: 'alacritty-revealui.toml',
        dest_path: '',
      },
      {
        id: 'kitty',
        name: 'Kitty',
        platform: 'Linux',
        installed: true,
        config_file: 'kitty-revealui.conf',
        dest_path: '',
      },
    ]);
  }
  return invoke<TerminalProfile[]>('terminal_detect');
}

export function terminalInstall(terminalId: string, configDir: string): Promise<TerminalProfile> {
  return invoke<TerminalProfile>('terminal_install', { terminalId, configDir });
}

// ── Launcher (quick-switch) ──────────────────────────────────────────────────

export function focusWindow(processName: string): Promise<boolean> {
  if (!isTauri()) {
    return Promise.resolve(false);
  }
  return invoke<boolean>('focus_window', { processName });
}

// Re-export AgentSession so consumers don't need to reach into types directly
export type { AgentSession };
