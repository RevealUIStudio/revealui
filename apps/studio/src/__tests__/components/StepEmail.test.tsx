import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StepEmail from '../../components/deploy/StepEmail';
import type { StudioConfig, WizardData } from '../../types';

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

function renderStep(overrides?: Partial<WizardData>) {
  const props = {
    config: MOCK_CONFIG,
    data: { ...MOCK_DATA, ...overrides },
    onUpdateData: vi.fn(),
    onUpdateConfig: vi.fn().mockResolvedValue(undefined),
    onNext: vi.fn().mockResolvedValue(undefined),
  };
  render(<StepEmail {...props} />);
  return props;
}

describe('StepEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Gmail configuration fields', () => {
    renderStep();

    expect(
      screen.getByPlaceholderText('revealui-email@project.iam.gserviceaccount.com'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----')).toBeInTheDocument(); // gitleaks:allow  -  placeholder text, not a real key
    expect(screen.getByPlaceholderText('noreply@yourdomain.com')).toBeInTheDocument();
  });

  it('renders test email input and send button', () => {
    renderStep();

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByText('Send Test Email')).toBeInTheDocument();
  });

  it('disables Next until test email is sent', () => {
    renderStep();

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('disables Send Test Email when fields are empty', () => {
    renderStep();

    expect(screen.getByText('Send Test Email')).toBeDisabled();
  });

  it('enables Send Test Email when all required fields are filled', () => {
    renderStep();

    fireEvent.change(
      screen.getByPlaceholderText('revealui-email@project.iam.gserviceaccount.com'),
      { target: { value: 'sa@project.iam.gserviceaccount.com' } },
    );
    fireEvent.change(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----'), {
      // gitleaks:allow
      target: { value: 'test-private-key-fixture' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });

    expect(screen.getByText('Send Test Email')).not.toBeDisabled();
  });

  it('shows success message after test email is sent', async () => {
    const { onUpdateData, onUpdateConfig } = renderStep();

    fireEvent.change(
      screen.getByPlaceholderText('revealui-email@project.iam.gserviceaccount.com'),
      { target: { value: 'sa@project.iam.gserviceaccount.com' } },
    );
    fireEvent.change(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----'), {
      // gitleaks:allow
      target: { value: 'test-private-key-fixture' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(screen.getByText('Test email sent  -  check your inbox.')).toBeInTheDocument();
    });

    expect(screen.getByText('Next')).not.toBeDisabled();
    expect(onUpdateData).toHaveBeenCalledWith({
      emailProvider: 'gmail',
      googleServiceAccountEmail: 'sa@project.iam.gserviceaccount.com',
      googlePrivateKey: 'test-private-key-fixture',
      emailFrom: '',
    });
    expect(onUpdateConfig).toHaveBeenCalled();
  });

  it('disables Send Test Email when service account fields are missing', () => {
    renderStep();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });

    expect(screen.getByText('Send Test Email')).toBeDisabled();
  });

  it('updates from address in wizard data', async () => {
    const { onUpdateData } = renderStep();

    fireEvent.change(
      screen.getByPlaceholderText('revealui-email@project.iam.gserviceaccount.com'),
      { target: { value: 'sa@project.iam.gserviceaccount.com' } },
    );
    fireEvent.change(screen.getByPlaceholderText('-----BEGIN PRIVATE KEY-----'), {
      // gitleaks:allow
      target: { value: 'test-private-key-fixture' },
    });
    fireEvent.change(screen.getByPlaceholderText('noreply@yourdomain.com'), {
      target: { value: 'noreply@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(screen.getByText('Test email sent  -  check your inbox.')).toBeInTheDocument();
    });

    expect(onUpdateData).toHaveBeenCalledWith(
      expect.objectContaining({
        emailFrom: 'noreply@example.com',
      }),
    );
  });

  it('pre-fills from existing wizard data', () => {
    renderStep({
      googleServiceAccountEmail: 'existing@project.iam.gserviceaccount.com',
      googlePrivateKey: 'existing-key',
      emailFrom: 'noreply@existing.com',
    });

    expect(
      screen.getByPlaceholderText('revealui-email@project.iam.gserviceaccount.com'),
    ).toHaveValue('existing@project.iam.gserviceaccount.com');
    expect(screen.getByPlaceholderText('noreply@yourdomain.com')).toHaveValue(
      'noreply@existing.com',
    );
  });
});
