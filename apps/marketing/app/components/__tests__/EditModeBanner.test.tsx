import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EDIT_QUERY_PARAM, SESSION_QUERY_PARAM } from '../../lib/edit-mode';
import { EditModeBanner } from '../EditModeBanner';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('EditModeBanner', () => {
  it('is hidden for ordinary visitors', () => {
    render(<EditModeBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('explains click-to-edit when the preview token is present', () => {
    window.history.replaceState({}, '', `/?${EDIT_QUERY_PARAM}=tok&${SESSION_QUERY_PARAM}=sid`);
    render(<EditModeBanner />);
    expect(screen.getByRole('status').textContent).toContain('Edit mode');
    expect(screen.getByRole('status').textContent).toContain('outlined copy');
  });
});
