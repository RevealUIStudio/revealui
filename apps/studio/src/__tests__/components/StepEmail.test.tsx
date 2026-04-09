import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StepEmail from '../../components/deploy/StepEmail';
import type { StudioConfig, WizardData } from '../../types';

const mockResendSendTest = vi.fn();
const mockSmtpSendTest = vi.fn();

beforeEach(() => {
  mockResendSendTest.mockReset();
  mockSmtpSendTest.mockReset();
});

vi.mock('../../lib/deploy', () => ({
  resendSendTest: (...args: unknown[]) => mockResendSendTest(...args),
  smtpSendTest: (...args: unknown[]) => mockSmtpSendTest(...args),
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
  it('renders provider toggle (Resend / SMTP)', () => {
    renderStep();

    expect(screen.getByText('Resend')).toBeInTheDocument();
    expect(screen.getByText('SMTP')).toBeInTheDocument();
  });

  it('shows Resend API key input by default', () => {
    renderStep();

    expect(screen.getByPlaceholderText('re_...')).toBeInTheDocument();
  });

  it('shows SMTP fields when SMTP is selected', () => {
    renderStep();

    fireEvent.click(screen.getByText('SMTP'));

    expect(screen.getByPlaceholderText('smtp.example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('587')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('SMTP password')).toBeInTheDocument();
  });

  it('disables Next until test email is sent', () => {
    renderStep();

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('calls resendSendTest for Resend provider', async () => {
    mockResendSendTest.mockResolvedValue(true);
    renderStep();

    fireEvent.change(screen.getByPlaceholderText('re_...'), {
      target: { value: 're_test_abc' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(screen.getByText('Test email sent — check your inbox.')).toBeInTheDocument();
    });

    expect(mockResendSendTest).toHaveBeenCalledWith('re_test_abc', 'test@example.com');
    expect(mockSmtpSendTest).not.toHaveBeenCalled();
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('calls smtpSendTest for SMTP provider', async () => {
    mockSmtpSendTest.mockResolvedValue(true);
    renderStep();

    fireEvent.click(screen.getByText('SMTP'));

    fireEvent.change(screen.getByPlaceholderText('smtp.example.com'), {
      target: { value: 'mail.test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
      target: { value: 'smtp-user@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('SMTP password'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'recipient@test.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(screen.getByText('Test email sent — check your inbox.')).toBeInTheDocument();
    });

    expect(mockSmtpSendTest).toHaveBeenCalledWith(
      'mail.test.com',
      587,
      'smtp-user@test.com',
      'secret123',
      'recipient@test.com',
    );
    expect(mockResendSendTest).not.toHaveBeenCalled();
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('shows error when SMTP fields are missing', async () => {
    renderStep();

    fireEvent.click(screen.getByText('SMTP'));

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(
        screen.getByText('SMTP host, username, and password are required'),
      ).toBeInTheDocument();
    });

    expect(mockSmtpSendTest).not.toHaveBeenCalled();
  });

  it('shows error when send fails', async () => {
    mockResendSendTest.mockRejectedValue(new Error('API key invalid'));
    renderStep();

    fireEvent.change(screen.getByPlaceholderText('re_...'), {
      target: { value: 're_bad_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(screen.getByText('API key invalid')).toBeInTheDocument();
    });

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('uses custom SMTP port when provided', async () => {
    mockSmtpSendTest.mockResolvedValue(true);
    renderStep();

    fireEvent.click(screen.getByText('SMTP'));

    fireEvent.change(screen.getByPlaceholderText('smtp.example.com'), {
      target: { value: 'mail.test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('587'), {
      target: { value: '465' },
    });
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('SMTP password'), {
      target: { value: 'pass' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'to@test.com' },
    });
    fireEvent.click(screen.getByText('Send Test Email'));

    await waitFor(() => {
      expect(screen.getByText('Test email sent — check your inbox.')).toBeInTheDocument();
    });

    expect(mockSmtpSendTest).toHaveBeenCalledWith(
      'mail.test.com',
      465,
      'user@test.com',
      'pass',
      'to@test.com',
    );
  });
});
