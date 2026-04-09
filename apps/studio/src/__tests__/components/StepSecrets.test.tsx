import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepSecrets from '../../components/deploy/StepSecrets';
import type { WizardData } from '../../types';

const mockGenerateSecret = vi.fn();
const mockGenerateKek = vi.fn();

vi.mock('../../lib/deploy', () => ({
  generateSecret: (...args: unknown[]) => mockGenerateSecret(...args),
  generateKek: (...args: unknown[]) => mockGenerateKek(...args),
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

describe('StepSecrets', () => {
  it('renders title and secret descriptions', () => {
    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Generate Secrets')).toBeInTheDocument();
    expect(screen.getByText('REVEALUI_SECRET')).toBeInTheDocument();
    expect(screen.getByText('REVEALUI_KEK')).toBeInTheDocument();
    expect(screen.getByText('REVEALUI_CRON_SECRET')).toBeInTheDocument();
  });

  it('shows Generate button when secrets not yet generated', () => {
    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Generate All Secrets')).toBeInTheDocument();
  });

  it('disables Next button before secrets are generated', () => {
    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('generates all 3 secrets on button click', async () => {
    mockGenerateSecret.mockResolvedValue('a'.repeat(48));
    mockGenerateKek.mockResolvedValue('b'.repeat(64));

    const onUpdateData = vi.fn();

    render(<StepSecrets data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Generate All Secrets'));

    await waitFor(() => {
      expect(onUpdateData).toHaveBeenCalledWith({
        revealuiSecret: 'a'.repeat(48),
        revealuiKek: 'b'.repeat(64),
        cronSecret: 'a'.repeat(48),
      });
    });

    // generateSecret called twice (revealuiSecret + cronSecret), generateKek once
    expect(mockGenerateSecret).toHaveBeenCalledTimes(2);
    expect(mockGenerateSecret).toHaveBeenCalledWith(48);
    expect(mockGenerateKek).toHaveBeenCalledTimes(1);
  });

  it('shows green checkmarks and Generated labels after generation', async () => {
    mockGenerateSecret.mockResolvedValue('a'.repeat(48));
    mockGenerateKek.mockResolvedValue('b'.repeat(64));

    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Generate All Secrets'));

    await waitFor(() => {
      const generatedLabels = screen.getAllByText('Generated');
      expect(generatedLabels).toHaveLength(3);
    });

    // Generate button should be gone
    expect(screen.queryByText('Generate All Secrets')).not.toBeInTheDocument();

    // Next button should be enabled
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('auto-detects already-generated secrets from data', () => {
    const prefilledData: WizardData = {
      ...MOCK_DATA,
      revealuiSecret: 'a'.repeat(48),
      revealuiKek: 'b'.repeat(64),
      cronSecret: 'c'.repeat(48),
    };

    render(<StepSecrets data={prefilledData} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    // Generate button should not appear
    expect(screen.queryByText('Generate All Secrets')).not.toBeInTheDocument();

    // Should show Generated labels
    const generatedLabels = screen.getAllByText('Generated');
    expect(generatedLabels).toHaveLength(3);

    // Next should be enabled
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('shows error message on generation failure', async () => {
    mockGenerateSecret.mockRejectedValue(new Error('Crypto unavailable'));

    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Generate All Secrets'));

    await waitFor(() => {
      expect(screen.getByText('Crypto unavailable')).toBeInTheDocument();
    });

    // Generate button should still be visible for retry
    expect(screen.getByText('Generate All Secrets')).toBeInTheDocument();
  });
});
