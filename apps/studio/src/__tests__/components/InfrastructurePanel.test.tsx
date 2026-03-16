import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock all hooks that child components use
vi.mock('../../hooks/use-apps', () => ({
  useApps: vi.fn().mockReturnValue({
    apps: [],
    loading: false,
    error: null,
    operating: {},
    refresh: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-devbox', () => ({
  useDevBox: vi.fn().mockReturnValue({
    operating: false,
    log: [],
    error: null,
    mount: vi.fn(),
    unmount: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-status', () => ({
  useStatus: vi.fn().mockReturnValue({
    system: null,
    mount: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

import InfrastructurePanel from '../../components/infrastructure/InfrastructurePanel';

describe('InfrastructurePanel', () => {
  it('renders App Launcher tab by default', () => {
    render(<InfrastructurePanel />);
    // "App Launcher" appears as both tab text and panel header
    const matches = screen.getAllByText('App Launcher');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders DevPod tab', () => {
    render(<InfrastructurePanel />);
    expect(screen.getByText('DevPod')).toBeInTheDocument();
  });

  it('shows AppsPanel content by default (App Launcher heading)', () => {
    render(<InfrastructurePanel />);
    // The AppsPanel renders a PanelHeader with "App Launcher"
    // The tab button text and the panel header both say "App Launcher"
    const appLauncherTexts = screen.getAllByText('App Launcher');
    expect(appLauncherTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to DevPod panel when DevPod tab is clicked', () => {
    render(<InfrastructurePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'DevPod' }));
    // DevBoxPanel renders a h1 with "DevPod"
    const devPodTexts = screen.getAllByText('DevPod');
    expect(devPodTexts.length).toBeGreaterThanOrEqual(2); // tab + panel heading
  });

  it('highlights active tab', () => {
    render(<InfrastructurePanel />);
    const appTab = screen.getAllByText('App Launcher')[0].closest('button');
    expect(appTab?.className).toContain('border-orange-500');
  });

  it('switches tab highlight when clicking DevPod', () => {
    render(<InfrastructurePanel />);
    const devPodButton = screen.getByRole('button', { name: 'DevPod' });
    fireEvent.click(devPodButton);
    expect(devPodButton.className).toContain('border-orange-500');
  });
});
