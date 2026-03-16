import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Tauri core invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Simulate non-Tauri environment (no __TAURI_INTERNALS__)
// The invoke.ts module checks for this to decide between mock and real IPC

describe('invoke bridge (browser mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure we're in browser mode (no __TAURI_INTERNALS__)
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getSystemStatus returns mock data in browser mode', async () => {
    const { getSystemStatus } = await import('../../lib/invoke');
    const result = await getSystemStatus();
    expect(result).toHaveProperty('wsl_running');
    expect(result).toHaveProperty('distribution');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('systemd_status');
  });

  it('getMountStatus returns mock data in browser mode', async () => {
    const { getMountStatus } = await import('../../lib/invoke');
    const result = await getMountStatus();
    expect(result).toHaveProperty('mounted');
    expect(result).toHaveProperty('mount_point');
  });

  it('mountDevbox returns mock string', async () => {
    const { mountDevbox } = await import('../../lib/invoke');
    const result = await mountDevbox();
    expect(typeof result).toBe('string');
  });

  it('unmountDevbox returns mock string', async () => {
    const { unmountDevbox } = await import('../../lib/invoke');
    const result = await unmountDevbox();
    expect(typeof result).toBe('string');
  });

  it('syncAllRepos returns mock array', async () => {
    const { syncAllRepos } = await import('../../lib/invoke');
    const result = await syncAllRepos();
    expect(Array.isArray(result)).toBe(true);
  });

  it('syncRepo returns mock SyncResult', async () => {
    const { syncRepo } = await import('../../lib/invoke');
    const result = await syncRepo('RevealUI');
    expect(result).toHaveProperty('drive');
    expect(result).toHaveProperty('repo');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('branch');
  });

  it('listApps returns mock app list', async () => {
    const { listApps } = await import('../../lib/invoke');
    const result = await listApps();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('app');
    expect(result[0]).toHaveProperty('running');
  });

  it('startApp returns mock string', async () => {
    const { startApp } = await import('../../lib/invoke');
    const result = await startApp('api');
    expect(typeof result).toBe('string');
  });

  it('stopApp returns mock string', async () => {
    const { stopApp } = await import('../../lib/invoke');
    const result = await stopApp('api');
    expect(typeof result).toBe('string');
  });

  it('readAppLog returns mock string', async () => {
    const { readAppLog } = await import('../../lib/invoke');
    const result = await readAppLog('api');
    expect(typeof result).toBe('string');
  });

  it('checkSetup returns mock SetupStatus', async () => {
    const { checkSetup } = await import('../../lib/invoke');
    const result = await checkSetup();
    expect(result).toHaveProperty('wsl_running');
    expect(result).toHaveProperty('nix_installed');
    expect(result).toHaveProperty('devbox_mounted');
    expect(result).toHaveProperty('git_name');
    expect(result).toHaveProperty('git_email');
  });

  it('setGitIdentity resolves void', async () => {
    const { setGitIdentity } = await import('../../lib/invoke');
    await expect(setGitIdentity('Test', 'test@example.com')).resolves.toBeUndefined();
  });

  it('vaultInit resolves void', async () => {
    const { vaultInit } = await import('../../lib/invoke');
    await expect(vaultInit()).resolves.toBeUndefined();
  });

  it('vaultIsInitialized returns boolean', async () => {
    const { vaultIsInitialized } = await import('../../lib/invoke');
    const result = await vaultIsInitialized();
    expect(typeof result).toBe('boolean');
  });

  it('vaultList returns mock secret list', async () => {
    const { vaultList } = await import('../../lib/invoke');
    const result = await vaultList();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('path');
    expect(result[0]).toHaveProperty('namespace');
  });

  it('vaultGet returns mock string', async () => {
    const { vaultGet } = await import('../../lib/invoke');
    const result = await vaultGet('stripe/secret_key');
    expect(typeof result).toBe('string');
  });

  it('vaultSet resolves void', async () => {
    const { vaultSet } = await import('../../lib/invoke');
    await expect(vaultSet('test/key', 'value', false)).resolves.toBeUndefined();
  });

  it('vaultDelete resolves void', async () => {
    const { vaultDelete } = await import('../../lib/invoke');
    await expect(vaultDelete('test/key')).resolves.toBeUndefined();
  });

  it('vaultSearch returns empty array', async () => {
    const { vaultSearch } = await import('../../lib/invoke');
    const result = await vaultSearch('query');
    expect(Array.isArray(result)).toBe(true);
  });

  it('vaultCopy resolves void', async () => {
    const { vaultCopy } = await import('../../lib/invoke');
    await expect(vaultCopy('secret')).resolves.toBeUndefined();
  });

  it('getTailscaleStatus returns mock status', async () => {
    const { getTailscaleStatus } = await import('../../lib/invoke');
    const result = await getTailscaleStatus();
    expect(result).toHaveProperty('running');
    expect(result).toHaveProperty('peers');
  });

  it('tailscaleUp returns mock string', async () => {
    const { tailscaleUp } = await import('../../lib/invoke');
    const result = await tailscaleUp();
    expect(typeof result).toBe('string');
  });

  it('tailscaleDown returns mock string', async () => {
    const { tailscaleDown } = await import('../../lib/invoke');
    const result = await tailscaleDown();
    expect(typeof result).toBe('string');
  });

  it('sshConnect returns mock session id', async () => {
    const { sshConnect } = await import('../../lib/invoke');
    const result = await sshConnect({
      host: 'example.com',
      port: 22,
      username: 'user',
      auth: { method: 'password', password: 'pass' },
    });
    expect(typeof result).toBe('string');
  });

  it('sshDisconnect resolves void', async () => {
    const { sshDisconnect } = await import('../../lib/invoke');
    await expect(sshDisconnect('session-1')).resolves.toBeUndefined();
  });

  it('sshSend resolves void', async () => {
    const { sshSend } = await import('../../lib/invoke');
    await expect(sshSend('session-1', 'ls\n')).resolves.toBeUndefined();
  });

  it('sshResize resolves void', async () => {
    const { sshResize } = await import('../../lib/invoke');
    await expect(sshResize('session-1', 80, 24)).resolves.toBeUndefined();
  });

  it('sshBookmarkList returns empty array', async () => {
    const { sshBookmarkList } = await import('../../lib/invoke');
    const result = await sshBookmarkList();
    expect(Array.isArray(result)).toBe(true);
  });

  it('sshBookmarkSave resolves void', async () => {
    const { sshBookmarkSave } = await import('../../lib/invoke');
    await expect(
      sshBookmarkSave({
        id: '1',
        label: 'test',
        host: 'host',
        port: 22,
        username: 'user',
        auth_method: 'key',
      }),
    ).resolves.toBeUndefined();
  });

  it('sshBookmarkDelete resolves void', async () => {
    const { sshBookmarkDelete } = await import('../../lib/invoke');
    await expect(sshBookmarkDelete('1')).resolves.toBeUndefined();
  });
});

describe('invoke bridge (Tauri mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate Tauri environment
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it('delegates to tauri invoke in Tauri mode', async () => {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    vi.mocked(tauriInvoke).mockResolvedValue({
      wsl_running: true,
      distribution: 'Ubuntu',
      tier: 'pro',
      systemd_status: 'running',
    });

    const { getSystemStatus } = await import('../../lib/invoke');
    const result = await getSystemStatus();
    expect(tauriInvoke).toHaveBeenCalledWith('get_system_status', undefined);
    expect(result.wsl_running).toBe(true);
  });
});
