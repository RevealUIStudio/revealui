import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SyncLog from '../../components/sync/SyncLog';

describe('SyncLog', () => {
  it('renders the "Sync Log" heading', () => {
    render(<SyncLog entries={[]} />);
    expect(screen.getByText('Sync Log')).toBeInTheDocument();
  });

  it('renders all log entries', () => {
    const entries = ['Syncing RevealUI...', 'Fetching origin...', 'Fast-forward to main'];
    render(<SyncLog entries={entries} />);
    for (const entry of entries) {
      expect(screen.getByText(entry)).toBeInTheDocument();
    }
  });

  it('renders empty log container when no entries', () => {
    const { container } = render(<SyncLog entries={[]} />);
    const logContainer = container.querySelector('.font-mono');
    expect(logContainer?.children.length).toBe(0);
  });
});
