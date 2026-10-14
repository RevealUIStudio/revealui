import type { CoordinationSessionRecord } from '@revealui/sync';
import { useCoordinationSessions } from '@revealui/sync';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoordinationPage from './page';

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@revealui/sync', () => ({
  ClientOnly: ({ children }: { children: React.ReactNode }) => children,
  useCoordinationSessions: vi.fn(),
}));

const mockSessions = vi.mocked(useCoordinationSessions);
const ended: CoordinationSessionRecord = {
  id: 'ended-session',
  agent_id: 'agent-one',
  started_at: '2026-10-01T12:00:00Z',
  ended_at: '2026-10-01T12:05:00Z',
  task: 'Finished review',
  status: 'ended',
  pid: null,
  tools: null,
  metadata: null,
};

beforeEach(() => {
  mockSessions.mockReturnValue({
    sessions: [],
    isLoading: false,
    error: null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  });
});
afterEach(cleanup);

describe('Coordination session scopes', () => {
  it('distinguishes no active sessions from an ended session available in All sessions', () => {
    mockSessions.mockReturnValue({
      sessions: [ended],
      isLoading: false,
      error: null,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });
    render(<CoordinationPage />);

    expect(screen.getByRole('heading', { name: 'Coordination sessions' })).toBeInTheDocument();
    expect(screen.getByText(/No recorded sessions are currently active/)).toBeInTheDocument();
    expect(screen.queryByText('Finished review')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All sessions' }));
    expect(screen.getByText('Finished review')).toBeInTheDocument();
    expect(screen.getByText('ended')).toBeInTheDocument();
    expect(screen.queryByText(/No recorded sessions/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ended.*agent-one.*Finished review/ }));
    expect(screen.getByText('Session ID:')).toBeInTheDocument();
    expect(screen.getByText('ended-session')).toBeInTheDocument();
  });

  it('does not infer that sessions ended when the entire recorded view is empty', () => {
    render(<CoordinationPage />);
    fireEvent.click(screen.getByRole('button', { name: 'All sessions' }));
    expect(
      screen.getByText('No coordination sessions are available in this view.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/all sessions have ended/i)).not.toBeInTheDocument();
  });
});
