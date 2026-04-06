import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useOnlineStatus.js', () => ({
  useOnlineStatus: vi.fn(),
}));

import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { SyncStatusIndicator } from '../SyncStatusIndicator.js';

const mockUseOnlineStatus = useOnlineStatus as ReturnType<typeof vi.fn>;

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: false,
      lastOnlineAt: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render a green dot when online and synced', () => {
    const { container } = render(<SyncStatusIndicator />);

    const dot = container.querySelector('span > span') as HTMLElement;
    expect(dot).toBeTruthy();
    // jsdom normalizes hex colors to rgb.
    expect(dot.style.backgroundColor).toBe('rgb(34, 197, 94)');
  });

  it('should show "Online" aria-label when online and synced', () => {
    render(<SyncStatusIndicator />);
    expect(screen.getByLabelText('Online')).toBeTruthy();
  });

  it('should render offline state with red dot and "Offline" text', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      wasOffline: false,
      lastOnlineAt: null,
    });

    render(<SyncStatusIndicator />);

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByLabelText('Offline')).toBeTruthy();
  });

  it('should render pulsing yellow dot when syncing', () => {
    const { container } = render(<SyncStatusIndicator isSyncing />);

    const dot = container.querySelector('span > span') as HTMLElement;
    // jsdom normalizes hex colors to rgb.
    expect(dot.style.backgroundColor).toBe('rgb(234, 179, 8)');
    expect(dot.style.animation).toContain('revealui-pulse');
  });

  it('should show "Synced" label when recently reconnected', () => {
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: true,
      lastOnlineAt: new Date(),
    });

    render(<SyncStatusIndicator />);

    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('should accept a className prop', () => {
    const { container } = render(<SyncStatusIndicator className="custom-class" />);

    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toBe('custom-class');
  });

  it('should default isSyncing to false', () => {
    const { container } = render(<SyncStatusIndicator />);

    const dot = container.querySelector('span > span') as HTMLElement;
    // Green, not yellow. jsdom normalizes hex to rgb.
    expect(dot.style.backgroundColor).toBe('rgb(34, 197, 94)');
  });
});
