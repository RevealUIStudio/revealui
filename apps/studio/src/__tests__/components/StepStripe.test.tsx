import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepStripe from '../../components/deploy/StepStripe';
import type { StudioConfig, WizardData } from '../../types';

const mockStripeValidateKeys = vi.fn();
const mockStripeRunSeed = vi.fn();
const mockGenerateRsaKeypair = vi.fn();

vi.mock('../../lib/deploy', () => ({
  stripeValidateKeys: (...args: unknown[]) => mockStripeValidateKeys(...args),
  stripeRunSeed: (...args: unknown[]) => mockStripeRunSeed(...args),
  generateRsaKeypair: (...args: unknown[]) => mockGenerateRsaKeypair(...args),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
};

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

const SEED_ENV_JSON = JSON.stringify({
  envVars: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_abc123',
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: 'price_pro_123',
    NEXT_PUBLIC_STRIPE_MAX_PRICE_ID: 'price_max_456',
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: 'price_ent_789',
  },
  catalogEntries: [],
});

describe('StepStripe', () => {
  it('renders key inputs and connect button', () => {
    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText('sk_test_...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('pk_test_...')).toBeInTheDocument();
    expect(screen.getByText('Connect & Configure')).toBeInTheDocument();
  });

  it('disables Connect button when keys are empty', () => {
    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByText('Connect & Configure')).toBeDisabled();
  });

  it('disables Next button before setup completes', () => {
    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('enables Connect button when both keys are entered', () => {
    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('sk_test_...'), {
      target: { value: 'sk_test_abc' },
    });
    fireEvent.change(screen.getByPlaceholderText('pk_test_...'), {
      target: { value: 'pk_test_abc' },
    });

    expect(screen.getByText('Connect & Configure')).not.toBeDisabled();
  });

  it('runs full phase sequence and captures seed output', async () => {
    mockStripeValidateKeys.mockResolvedValue(true);
    mockGenerateRsaKeypair.mockResolvedValue(['RSA_PRIVATE_PEM', 'RSA_PUBLIC_PEM']);
    mockStripeRunSeed.mockResolvedValue(SEED_ENV_JSON);

    const onUpdateData = vi.fn();

    render(
      <StepStripe
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={onUpdateData}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('sk_test_...'), {
      target: { value: 'sk_test_secret' },
    });
    fireEvent.change(screen.getByPlaceholderText('pk_test_...'), {
      target: { value: 'pk_test_pub' },
    });
    fireEvent.click(screen.getByText('Connect & Configure'));

    await waitFor(() => {
      expect(screen.getByText('Stripe connected')).toBeInTheDocument();
    });

    // Validate → RSA → Seed sequence
    expect(mockStripeValidateKeys).toHaveBeenCalledWith('sk_test_secret');
    expect(mockGenerateRsaKeypair).toHaveBeenCalled();
    expect(mockStripeRunSeed).toHaveBeenCalledWith('.');

    // onUpdateData receives parsed webhook secret, price IDs, and RSA keys
    expect(onUpdateData).toHaveBeenCalledWith({
      stripeSecretKey: 'sk_test_secret',
      stripePublishableKey: 'pk_test_pub',
      stripeWebhookSecret: 'whsec_test_abc123',
      stripePriceIds: {
        pro: 'price_pro_123',
        max: 'price_max_456',
        enterprise: 'price_ent_789',
      },
      licensePrivateKey: 'RSA_PRIVATE_PEM',
      licensePublicKey: 'RSA_PUBLIC_PEM',
    });

    // Next button should be enabled
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('handles non-JSON seed output gracefully', async () => {
    mockStripeValidateKeys.mockResolvedValue(true);
    mockGenerateRsaKeypair.mockResolvedValue(['PRIV', 'PUB']);
    mockStripeRunSeed.mockResolvedValue('Seed complete (plain text)');

    const onUpdateData = vi.fn();

    render(
      <StepStripe
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={onUpdateData}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('sk_test_...'), {
      target: { value: 'sk_test_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('pk_test_...'), {
      target: { value: 'pk_test_key' },
    });
    fireEvent.click(screen.getByText('Connect & Configure'));

    await waitFor(() => {
      expect(screen.getByText('Stripe connected')).toBeInTheDocument();
    });

    // Should still call onUpdateData with empty webhook/price fields
    expect(onUpdateData).toHaveBeenCalledWith({
      stripeSecretKey: 'sk_test_key',
      stripePublishableKey: 'pk_test_key',
      stripeWebhookSecret: '',
      stripePriceIds: { pro: '', max: '', enterprise: '' },
      licensePrivateKey: 'PRIV',
      licensePublicKey: 'PUB',
    });
  });

  it('shows error and returns to input phase on failure', async () => {
    mockStripeValidateKeys.mockRejectedValue(new Error('Invalid API key'));

    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('sk_test_...'), {
      target: { value: 'sk_test_bad' },
    });
    fireEvent.change(screen.getByPlaceholderText('pk_test_...'), {
      target: { value: 'pk_test_bad' },
    });
    fireEvent.click(screen.getByText('Connect & Configure'));

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });

    // Connect button should be re-enabled
    expect(screen.getByText('Connect & Configure')).not.toBeDisabled();
  });

  it('shows phase progress labels during execution', async () => {
    let resolveValidate: (v: boolean) => void;
    mockStripeValidateKeys.mockImplementation(
      () =>
        new Promise<boolean>((r) => {
          resolveValidate = r;
        }),
    );
    mockGenerateRsaKeypair.mockResolvedValue(['PRIV', 'PUB']);
    mockStripeRunSeed.mockResolvedValue(SEED_ENV_JSON);

    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('sk_test_...'), {
      target: { value: 'sk_test_x' },
    });
    fireEvent.change(screen.getByPlaceholderText('pk_test_...'), {
      target: { value: 'pk_test_x' },
    });
    fireEvent.click(screen.getByText('Connect & Configure'));

    // Should show validating phase
    await waitFor(() => {
      expect(screen.getByText('Validating keys...')).toBeInTheDocument();
    });

    // Resolve validation to advance phases
    resolveValidate!(true);

    await waitFor(() => {
      expect(screen.getByText('Stripe connected')).toBeInTheDocument();
    });
  });
});
