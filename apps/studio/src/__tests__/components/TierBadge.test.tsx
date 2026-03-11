import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TierBadge from '../../components/dashboard/TierBadge';

describe('TierBadge', () => {
  it('renders the tier label', () => {
    render(<TierBadge tier="pro" />);
    expect(screen.getByText('pro')).toBeInTheDocument();
  });

  it('applies T1 styling for T1 tier', () => {
    render(<TierBadge tier="T1" />);
    const badge = screen.getByText('T1');
    expect(badge.className).toContain('text-orange-400');
  });

  it('applies T0 styling for T0 tier', () => {
    render(<TierBadge tier="T0" />);
    const badge = screen.getByText('T0');
    expect(badge.className).toContain('text-neutral-400');
  });

  it('applies default styling for unknown tier', () => {
    render(<TierBadge tier="custom" />);
    const badge = screen.getByText('custom');
    expect(badge.className).toContain('bg-neutral-800');
  });
});
