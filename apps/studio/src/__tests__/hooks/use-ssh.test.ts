import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSsh } from '../../hooks/use-ssh';
import type { SshConnectParams } from '../../types';

const { mockUnlisten } = vi.hoisted(() => ({
  mockUnlisten: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(mockUnlisten),
}));

vi.mock('../../lib/invoke', () => ({
  sshConnect: vi.fn(),
  sshDisconnect: vi.fn().mockResolvedValue(undefined),
  sshSend: vi.fn(),
  sshResize: vi.fn(),
}));

const { sshConnect, sshDisconnect, sshSend, sshResize } = await import('../../lib/invoke');

const CONNECT_PARAMS: SshConnectParams = {
  host: '192.168.1.100',
  port: 22,
  username: 'admin',
  auth: { method: 'password', password: 'secret' },
};

describe('useSsh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnlisten.mockClear();
    // Ensure sshDisconnect always returns a Promise (cleanup effect calls .catch())
    vi.mocked(sshDisconnect).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with disconnected state', () => {
    const { result } = renderHook(() => useSsh());

    expect(result.current.sessionId).toBeNull();
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('connects successfully', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    expect(sshConnect).toHaveBeenCalledWith(CONNECT_PARAMS);
    expect(result.current.sessionId).toBe('session-abc');
    expect(result.current.connected).toBe(true);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles connect error', async () => {
    vi.mocked(sshConnect).mockRejectedValueOnce(new Error('Connection refused'));

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBe('Connection refused');
    expect(result.current.sessionId).toBeNull();
  });

  it('disconnects successfully', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');
    vi.mocked(sshDisconnect).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(sshDisconnect).toHaveBeenCalledWith('session-abc');
    expect(result.current.sessionId).toBeNull();
    expect(result.current.connected).toBe(false);
  });

  it('handles disconnect error silently', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');
    vi.mocked(sshDisconnect).mockRejectedValueOnce(new Error('Already closed'));

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    // Should not throw
    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.sessionId).toBeNull();
  });

  it('disconnect is no-op when not connected', async () => {
    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(sshDisconnect).not.toHaveBeenCalled();
  });

  it('sends data when connected', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');
    vi.mocked(sshSend).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    await act(async () => {
      await result.current.send('ls -la\n');
    });

    expect(sshSend).toHaveBeenCalledWith('session-abc', btoa('ls -la\n'));
  });

  it('send is no-op when not connected', async () => {
    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.send('test');
    });

    expect(sshSend).not.toHaveBeenCalled();
  });

  it('resizes terminal when connected', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');
    vi.mocked(sshResize).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    await act(async () => {
      await result.current.resize(120, 40);
    });

    expect(sshResize).toHaveBeenCalledWith('session-abc', 120, 40);
  });

  it('resize is no-op when not connected', async () => {
    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.resize(80, 24);
    });

    expect(sshResize).not.toHaveBeenCalled();
  });

  it('cleans up listeners on unmount', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');
    vi.mocked(sshDisconnect).mockResolvedValueOnce(undefined);

    const { result, unmount } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    unmount();

    // sshDisconnect called with best-effort cleanup
    expect(sshDisconnect).toHaveBeenCalledWith('session-abc');
    // unlisten functions should have been called
    expect(mockUnlisten).toHaveBeenCalled();
  });

  it('cleans up listeners on disconnect', async () => {
    vi.mocked(sshConnect).mockResolvedValueOnce('session-abc');
    vi.mocked(sshDisconnect).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(CONNECT_PARAMS);
    });

    mockUnlisten.mockClear();

    await act(async () => {
      await result.current.disconnect();
    });

    // 3 listeners: output, disconnect, hostkey
    expect(mockUnlisten).toHaveBeenCalledTimes(3);
  });

  it('connects with key auth', async () => {
    const keyParams: SshConnectParams = {
      host: '10.0.0.1',
      port: 2222,
      username: 'deploy',
      auth: { method: 'key', key_path: '/home/user/.ssh/id_ed25519', passphrase: null },
    };

    vi.mocked(sshConnect).mockResolvedValueOnce('session-key');

    const { result } = renderHook(() => useSsh());

    await act(async () => {
      await result.current.connect(keyParams);
    });

    expect(sshConnect).toHaveBeenCalledWith(keyParams);
    expect(result.current.connected).toBe(true);
  });
});
