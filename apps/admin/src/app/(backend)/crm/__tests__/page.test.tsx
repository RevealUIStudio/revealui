import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmPage from '../page';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/utils/csrf', () => ({ apiFetch: api.fetch }));
beforeEach(() => {
  api.fetch.mockReset();
  api.fetch.mockImplementation(
    async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
});
describe('CRM workspace journey', () => {
  it('opens only the chosen authorized account and presents an empty state', async () => {
    const user = userEvent.setup();
    render(<CrmPage />);
    expect(api.fetch).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Account ID'), 'workspace-a');
    await user.click(screen.getByRole('button', { name: 'Open account' }));
    await screen.findByText('No records yet.');
    expect(api.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/organizations'),
      expect.objectContaining({ headers: { 'X-Account-ID': 'workspace-a' } }),
    );
  });
  it('requires preview before import and invalidates preview when the CSV changes', async () => {
    const user = userEvent.setup();
    render(<CrmPage />);
    await user.type(screen.getByLabelText('Account ID'), 'workspace-a');
    await user.click(screen.getByRole('button', { name: 'Open account' }));
    await screen.findByText('No records yet.');
    await user.click(screen.getByRole('button', { name: 'Imports' }));
    expect(screen.queryByRole('button', { name: 'Confirm import' })).toBeNull();
    fireEvent.change(screen.getByLabelText('CSV'), {
      target: { value: 'name,sourceUrl\nExample,https://example.test' },
    });
    await user.click(screen.getByRole('button', { name: 'Preview import' }));
    await screen.findByRole('button', { name: 'Confirm import' });
    await waitFor(() =>
      expect(api.fetch).toHaveBeenCalledWith(
        '/api/crm/imports/preview',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    fireEvent.change(screen.getByLabelText('CSV'), {
      target: { value: 'name,sourceUrl\nChanged,https://changed.test' },
    });
    expect(screen.queryByRole('button', { name: 'Confirm import' })).toBeNull();
  });
});
