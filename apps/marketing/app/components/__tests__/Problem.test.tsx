import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOME_PROBLEM } from '../../content/home';
import { Problem } from '../landing/Problem';

describe('Problem capability stack', () => {
  it('renders no table and no path cards', () => {
    const { container } = render(<Problem />);
    expect(container.querySelector('table')).toBeNull();
    // Stacked list of capabilities, not a card matrix.
    expect(screen.getByRole('list', { name: HOME_PROBLEM.tableAriaLabel })).toBeTruthy();
    expect(container.querySelectorAll('[class*="rounded-2xl"]').length).toBe(0);
  });

  it('lists every capability once as a heading', () => {
    render(<Problem />);
    for (const row of HOME_PROBLEM.rows) {
      expect(screen.getByRole('heading', { level: 3, name: row.capability })).toBeTruthy();
    }
  });

  it('keeps path blurbs and every row claim', () => {
    render(<Problem />);
    expect(screen.getByText(HOME_PROBLEM.highlightedLabel)).toBeTruthy();
    expect(screen.getByText(HOME_PROBLEM.pathBlurbs.sprawl)).toBeTruthy();
    expect(screen.getByText(HOME_PROBLEM.pathBlurbs.agentOnly)).toBeTruthy();
    expect(screen.getByText(HOME_PROBLEM.pathBlurbs.revealui)).toBeTruthy();

    for (const row of HOME_PROBLEM.rows) {
      expect(screen.getByText(row.sprawl)).toBeTruthy();
      expect(screen.getByText(row.revealui)).toBeTruthy();
    }
    expect(screen.getAllByText('Bring your own').length).toBeGreaterThanOrEqual(1);
  });

  it('aligns answers under each capability (definition list)', () => {
    const { container } = render(<Problem />);
    const dls = container.querySelectorAll('dl');
    expect(dls.length).toBe(HOME_PROBLEM.rows.length);
    // Each capability has three answers (sprawl / agentOnly / revealui).
    for (const dl of dls) {
      expect(dl.querySelectorAll('dt').length).toBe(3);
      expect(dl.querySelectorAll('dd').length).toBe(3);
    }
  });
});
