import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MountLog from '../../components/devbox/MountLog';

describe('MountLog', () => {
  it('renders the "Log" heading', () => {
    render(<MountLog entries={[]} />);
    expect(screen.getByText('Log')).toBeInTheDocument();
  });

  it('renders log entries', () => {
    const entries = ['Mounting /dev/sdc...', 'Mount complete', 'Verified integrity'];
    render(<MountLog entries={entries} />);
    for (const entry of entries) {
      expect(screen.getByText(entry)).toBeInTheDocument();
    }
  });

  it('renders empty when no entries', () => {
    const { container } = render(<MountLog entries={[]} />);
    const logContainer = container.querySelector('.font-mono');
    expect(logContainer?.children.length).toBe(0);
  });
});
