import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerdictChip } from '../../components/verdict-chip.js';

describe('VerdictChip', () => {
  it('renders the verdict word for each verdict', () => {
    const cases: Array<[Parameters<typeof VerdictChip>[0]['verdict'], string]> = [
      ['approve', 'Approved'],
      ['request-changes', 'Changes requested'],
      ['hold', 'On hold'],
      ['pending', 'Pending'],
    ];
    for (const [verdict, word] of cases) {
      const { unmount } = render(<VerdictChip verdict={verdict} />);
      expect(screen.getByText(word)).toBeInTheDocument();
      unmount();
    }
  });

  it('maps each verdict to its semantic --rvui-* token classes', () => {
    const cases: Array<[Parameters<typeof VerdictChip>[0]['verdict'], string]> = [
      ['approve', 'text-[var(--rvui-success)]'],
      ['request-changes', 'text-[var(--rvui-error)]'],
      ['hold', 'text-[var(--rvui-warning)]'],
      ['pending', 'text-[var(--rvui-text-2)]'],
    ];
    for (const [verdict, token] of cases) {
      const { unmount } = render(<VerdictChip verdict={verdict} />);
      expect(screen.getByRole('img').className).toContain(token);
      unmount();
    }
  });

  it('composes actor and asOf into the accessible label', () => {
    render(<VerdictChip verdict="approve" actor="alice" asOf="2026-07-16" />);
    expect(
      screen.getByRole('img', { name: 'Approved by alice as of 2026-07-16' }),
    ).toBeInTheDocument();
  });

  it('shows the actor visibly when provided', () => {
    render(<VerdictChip verdict="hold" actor="bob" />);
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });
});
