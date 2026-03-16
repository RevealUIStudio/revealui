import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StepVerify from '../../components/deploy/StepVerify';
import type { StudioConfig, WizardData } from '../../types';

const mockHealthCheck = vi.fn();
const mockVercelSetEnv = vi.fn();
const mockResendSendTest = vi.fn();

vi.mock('../../lib/deploy', () => ({
  healthCheck: (...args: unknown[]) => mockHealthCheck(...args),
  vercelSetEnv: (...args: unknown[]) => mockVercelSetEnv(...args),
  resendSendTest: (...args: unknown[]) => mockResendSendTest(...args),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
  deploy: {
    supabaseEnabled: false,
    apps: { api: 'prj-api', cms: 'prj-cms', marketing: 'prj-mkt' },
  },
};

const MOCK_DATA: WizardData = {
  vercelToken: 'tok_test',
  vercelProjects: { api: 'prj-api', cms: 'prj-cms', marketing: 'prj-mkt' },
  postgresUrl: 'postgres://localhost/test',
  stripeSecretKey: 'sk_test_123',
  stripePublishableKey: 'pk_test_123',
  stripeWebhookSecret: 'whsec_123',
  stripePriceIds: { pro: 'price_pro', max: 'price_max', enterprise: 'price_ent' },
  licensePrivateKey: 'PRIVATE_KEY',
  licensePublicKey: 'PUBLIC_KEY',
  emailProvider: 'resend',
  resendApiKey: 'rk_test_123',
  blobToken: 'blob_test',
  revealuiSecret: 'secret_test',
  revealuiKek: 'kek_test',
  cronSecret: 'cron_test',
  domain: 'example.com',
  signupOpen: true,
};

describe('StepVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthCheck.mockResolvedValue(200);
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockResendSendTest.mockResolvedValue(true);
  });

  it('renders admin inputs and check rows including Email Delivery', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    expect(screen.getByLabelText('Admin Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin Password')).toBeInTheDocument();
    expect(screen.getByText('API Health')).toBeInTheDocument();
    expect(screen.getByText('CMS')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Database (via API)')).toBeInTheDocument();
    expect(screen.getByText('Email Delivery')).toBeInTheDocument();
  });

  it('disables Run Checks when admin fields are empty', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    const button = screen.getByRole('button', { name: /run checks/i });
    expect(button).toBeDisabled();
  });

  it('disables Complete Setup until all checks pass', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    const button = screen.getByRole('button', { name: /complete setup/i });
    expect(button).toBeDisabled();
  });

  it('shows password length error when < 12 chars', async () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('Admin password must be at least 12 characters')).toBeInTheDocument();
    });

    // Should not have called any deploy functions
    expect(mockHealthCheck).not.toHaveBeenCalled();
    expect(mockVercelSetEnv).not.toHaveBeenCalled();
  });

  it('shows cron job verification note', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    expect(screen.getByText('Cron jobs')).toBeInTheDocument();
    expect(screen.getByText(/support-renewal-check/)).toBeInTheDocument();
    expect(screen.getByText(/report-agent-overage/)).toBeInTheDocument();
  });

  it('shows manual verification section', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    expect(screen.getByText('Manual verification (after setup):')).toBeInTheDocument();
    expect(screen.getByText('Stripe webhook test event fires and is received')).toBeInTheDocument();
    expect(screen.getByText(/CORS allows CMS/)).toBeInTheDocument();
    expect(screen.getByText('Session cookie works cross-subdomain')).toBeInTheDocument();
    expect(screen.getByText('Signup flow works end-to-end')).toBeInTheDocument();
  });

  it('runs all checks including email delivery on valid input', async () => {
    const onComplete = vi.fn();
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('Test email sent')).toBeInTheDocument();
    });

    expect(mockResendSendTest).toHaveBeenCalledWith('rk_test_123', 'admin@test.com');
    expect(mockHealthCheck).toHaveBeenCalledTimes(4);
  });

  it('marks email as validated in email step for SMTP provider', async () => {
    const smtpData: WizardData = {
      ...MOCK_DATA,
      emailProvider: 'smtp',
      resendApiKey: undefined,
    };

    render(<StepVerify config={MOCK_CONFIG} data={smtpData} onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('Validated in email step')).toBeInTheDocument();
    });

    expect(mockResendSendTest).not.toHaveBeenCalled();
  });
});
