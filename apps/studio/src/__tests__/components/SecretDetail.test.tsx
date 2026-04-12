import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/invoke', () => ({
  vaultCopy: vi.fn(),
}));

import SecretDetail from '../../components/vault/SecretDetail';

describe('SecretDetail', () => {
  it('shows placeholder when no path is selected', () => {
    render(<SecretDetail path={null} value={null} loading={false} />);
    expect(screen.getByText('Select a secret to view its value')).toBeInTheDocument();
  });

  it('displays the path when selected', () => {
    render(<SecretDetail path="stripe/secret_key" value="sk_test_123" loading={false} />);
    expect(screen.getByText('stripe/secret_key')).toBeInTheDocument();
  });

  it('displays value as blurred by default', () => {
    render(<SecretDetail path="stripe/secret_key" value="sk_test_123" loading={false} />);
    const valueEl = screen.getByText('sk_test_123');
    expect(valueEl.className).toContain('blur-sm');
  });

  it('reveals value when Reveal button is clicked', () => {
    render(<SecretDetail path="stripe/secret_key" value="sk_test_123" loading={false} />);
    fireEvent.click(screen.getByText('Reveal'));
    const valueEl = screen.getByText('sk_test_123');
    expect(valueEl.className).not.toContain('blur-sm');
    expect(screen.getByText('Hide')).toBeInTheDocument();
  });

  it('hides value again when Hide button is clicked', () => {
    render(<SecretDetail path="stripe/secret_key" value="sk_test_123" loading={false} />);
    fireEvent.click(screen.getByText('Reveal'));
    fireEvent.click(screen.getByText('Hide'));
    const valueEl = screen.getByText('sk_test_123');
    expect(valueEl.className).toContain('blur-sm');
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(
      <SecretDetail path="stripe/secret_key" value={null} loading={true} />,
    );
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('disables Copy button when no value', () => {
    render(<SecretDetail path="stripe/secret_key" value={null} loading={false} />);
    const copyButton = screen.getByText('Copy').closest('button');
    expect(copyButton).toBeDisabled();
  });

  it('disables Copy button when loading', () => {
    render(<SecretDetail path="stripe/secret_key" value="val" loading={true} />);
    const copyButton = screen.getByText('Copy').closest('button');
    expect(copyButton).toBeDisabled();
  });

  it('calls vaultCopy when Copy button is clicked', async () => {
    const { vaultCopy } = await import('../../lib/invoke');
    vi.mocked(vaultCopy).mockResolvedValue(undefined);

    render(<SecretDetail path="stripe/secret_key" value="sk_test_123" loading={false} />);
    fireEvent.click(screen.getByText('Copy'));
    expect(vaultCopy).toHaveBeenCalledWith('sk_test_123');
  });

  it('shows dash when value is null and not loading', () => {
    render(<SecretDetail path="stripe/secret_key" value={null} loading={false} />);
    const preEl = screen.getByText('-');
    expect(preEl).toBeInTheDocument();
  });
});
