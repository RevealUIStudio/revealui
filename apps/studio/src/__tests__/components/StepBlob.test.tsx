import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepBlob from '../../components/deploy/StepBlob';
import type { WizardData } from '../../types';

const mockVercelValidateBlobToken = vi.fn();

vi.mock('../../lib/deploy', () => ({
  vercelValidateBlobToken: (...args: unknown[]) => mockVercelValidateBlobToken(...args),
}));

const MOCK_DATA: WizardData = {
  vercelToken: '',
  vercelProjects: { api: '', admin: '', marketing: '' },
  postgresUrl: '',
  stripeSecretKey: '',
  stripePublishableKey: '',
  stripeWebhookSecret: '',
  stripePriceIds: { pro: '', max: '', enterprise: '' },
  licensePrivateKey: '',
  licensePublicKey: '',
  emailProvider: 'gmail',
  blobToken: '',
  revealuiSecret: '',
  revealuiKek: '',
  cronSecret: '',
  domain: '',
  signupOpen: true,
};

describe('StepBlob', () => {
  it('renders token input and instructions', () => {
    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Blob Storage')).toBeInTheDocument();
    expect(screen.getByText('Setup instructions:')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('vercel_blob_rw_...')).toBeInTheDocument();
    expect(screen.getByLabelText('BLOB_READ_WRITE_TOKEN')).toBeInTheDocument();
  });

  it('disables Save button when token is empty', () => {
    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Save Token')).toBeDisabled();
  });

  it('disables Next until token is saved', () => {
    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('validates token before saving and calls onUpdateData on success', async () => {
    mockVercelValidateBlobToken.mockResolvedValue(true);
    const onUpdateData = vi.fn();

    render(<StepBlob data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('vercel_blob_rw_...'), {
      target: { value: 'test-blob-token' },
    });
    fireEvent.click(screen.getByText('Save Token'));

    await waitFor(() => {
      expect(screen.getByText('Token saved')).toBeInTheDocument();
    });

    expect(mockVercelValidateBlobToken).toHaveBeenCalledWith('test-blob-token');
    expect(onUpdateData).toHaveBeenCalledWith({ blobToken: 'test-blob-token' });
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('shows error when validation returns false', async () => {
    mockVercelValidateBlobToken.mockResolvedValue(false);
    const onUpdateData = vi.fn();

    render(<StepBlob data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('vercel_blob_rw_...'), {
      target: { value: 'test-bad-token' },
    });
    fireEvent.click(screen.getByText('Save Token'));

    await waitFor(() => {
      expect(
        screen.getByText('Invalid blob token — check the token has read+write permissions.'),
      ).toBeInTheDocument();
    });

    expect(onUpdateData).not.toHaveBeenCalled();
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('shows error when validation throws', async () => {
    mockVercelValidateBlobToken.mockRejectedValue(new Error('Network error'));
    const onUpdateData = vi.fn();

    render(<StepBlob data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('vercel_blob_rw_...'), {
      target: { value: 'test-err-token' },
    });
    fireEvent.click(screen.getByText('Save Token'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(onUpdateData).not.toHaveBeenCalled();
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('trims whitespace from token before validating', async () => {
    mockVercelValidateBlobToken.mockResolvedValue(true);
    const onUpdateData = vi.fn();

    render(<StepBlob data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('vercel_blob_rw_...'), {
      target: { value: '  test-spaced-token  ' },
    });
    fireEvent.click(screen.getByText('Save Token'));

    await waitFor(() => {
      expect(screen.getByText('Token saved')).toBeInTheDocument();
    });

    expect(mockVercelValidateBlobToken).toHaveBeenCalledWith('test-spaced-token');
    expect(onUpdateData).toHaveBeenCalledWith({ blobToken: 'test-spaced-token' });
  });

  it('clears error when token input changes', async () => {
    mockVercelValidateBlobToken.mockResolvedValue(false);

    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('vercel_blob_rw_...'), {
      target: { value: 'test-bad-token' },
    });
    fireEvent.click(screen.getByText('Save Token'));

    await waitFor(() => {
      expect(
        screen.getByText('Invalid blob token — check the token has read+write permissions.'),
      ).toBeInTheDocument();
    });

    // The input is disabled after save attempt when saved=true, but since validation failed,
    // saved stays false, so input should still be editable
    fireEvent.change(screen.getByPlaceholderText('vercel_blob_rw_...'), {
      target: { value: 'test-new-token' },
    });

    expect(
      screen.queryByText('Invalid blob token — check the token has read+write permissions.'),
    ).not.toBeInTheDocument();
  });
});
