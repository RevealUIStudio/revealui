import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateSecretDialog from '../../components/vault/CreateSecretDialog';

describe('CreateSecretDialog', () => {
  it('renders "New Secret" title', () => {
    render(<CreateSecretDialog onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('New Secret')).toBeInTheDocument();
  });

  it('renders path and value inputs', () => {
    render(<CreateSecretDialog onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('namespace/key-name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Secret value...')).toBeInTheDocument();
  });

  it('renders Cancel and Save Secret buttons', () => {
    render(<CreateSecretDialog onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save Secret')).toBeInTheDocument();
  });

  it('disables Save Secret when fields are empty', () => {
    render(<CreateSecretDialog onConfirm={vi.fn()} onClose={vi.fn()} />);
    const saveButton = screen.getByText('Save Secret').closest('button');
    expect(saveButton).toBeDisabled();
  });

  it('enables Save Secret when both fields have values', () => {
    render(<CreateSecretDialog onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('namespace/key-name'), {
      target: { value: 'stripe/api_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('Secret value...'), {
      target: { value: 'sk_test_123' },
    });
    const saveButton = screen.getByText('Save Secret').closest('button');
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CreateSecretDialog onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onConfirm with trimmed path and value on submit', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<CreateSecretDialog onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('namespace/key-name'), {
      target: { value: '  stripe/api_key  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Secret value...'), {
      target: { value: '  sk_test_123  ' },
    });

    // Submit via Save Secret button click
    fireEvent.click(screen.getByText('Save Secret'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('stripe/api_key', 'sk_test_123');
    });
  });

  it('shows error message when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Vault error'));
    render(<CreateSecretDialog onConfirm={onConfirm} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('namespace/key-name'), {
      target: { value: 'stripe/api_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('Secret value...'), {
      target: { value: 'sk_test_123' },
    });

    fireEvent.click(screen.getByText('Save Secret'));

    await waitFor(() => {
      expect(screen.getByText('Vault error')).toBeInTheDocument();
    });
  });
});
