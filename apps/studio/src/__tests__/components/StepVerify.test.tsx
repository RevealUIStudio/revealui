import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StepVerify from '../../components/deploy/StepVerify';
import type { StudioConfig, WizardData } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHealthCheck = vi.fn();
const mockVercelSetEnv = vi.fn();

vi.mock('../../lib/deploy', () => ({
  healthCheck: (...args: unknown[]) => mockHealthCheck(...args),
  vercelSetEnv: (...args: unknown[]) => mockVercelSetEnv(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
  deploy: {
    supabaseEnabled: false,
    apps: { api: 'prj-api-123', admin: 'prj-admin', marketing: 'prj-mkt' },
  },
};

const BASE_DATA: WizardData = {
  vercelToken: 'tok_test',
  vercelProjects: { api: 'prj-api', admin: 'prj-admin', marketing: 'prj-mkt' },
  postgresUrl: 'postgres://localhost/test',
  stripeSecretKey: 'sk_test_123',
  stripePublishableKey: 'pk_test_123',
  stripeWebhookSecret: 'whsec_123',
  stripePriceIds: { pro: 'price_pro', max: 'price_max', enterprise: 'price_ent' },
  licensePrivateKey: 'PRIVATE_KEY',
  licensePublicKey: 'PUBLIC_KEY',
  emailProvider: 'gmail',
  googleServiceAccountEmail: 'sa@project.iam.gserviceaccount.com',
  googlePrivateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
  emailFrom: 'noreply@example.com',
  blobToken: 'blob_test',
  revealuiSecret: 'secret_test',
  revealuiKek: 'kek_test',
  cronSecret: 'cron_test',
  domain: 'example.com',
  signupOpen: true,
};

function renderStep(overrides?: { config?: Partial<StudioConfig>; data?: Partial<WizardData> }) {
  const onComplete = vi.fn();
  const config = { ...BASE_CONFIG, ...overrides?.config } as StudioConfig;
  const data = { ...BASE_DATA, ...overrides?.data } as WizardData;

  const result = render(<StepVerify config={config} data={data} onComplete={onComplete} />);
  return { ...result, onComplete };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthCheck.mockResolvedValue(200);
    mockVercelSetEnv.mockResolvedValue(undefined);
  });

  // -- Rendering ----------------------------------------------------------

  it('renders title and description', () => {
    renderStep();

    expect(screen.getByText('Bootstrap & Verify')).toBeInTheDocument();
    expect(screen.getByText(/Create admin account/)).toBeInTheDocument();
  });

  it('renders admin email and password inputs', () => {
    renderStep();

    expect(screen.getByLabelText('Admin Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin Password')).toBeInTheDocument();
  });

  it('renders all five check rows including Email Delivery', () => {
    renderStep();

    expect(screen.getByText('API Health')).toBeInTheDocument();
    expect(screen.getByText('CMS')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Database (via API)')).toBeInTheDocument();
    expect(screen.getByText('Email Delivery')).toBeInTheDocument();
  });

  it('renders Run Checks button', () => {
    renderStep();

    expect(screen.getByRole('button', { name: /run checks/i })).toBeInTheDocument();
  });

  it('renders Complete Setup button (disabled by default)', () => {
    renderStep();

    const btn = screen.getByRole('button', { name: /complete setup/i });
    expect(btn).toBeDisabled();
  });

  // -- Validation ---------------------------------------------------------

  it('disables Run Checks when email is empty', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'StrongPass1!xx' },
    });

    expect(screen.getByRole('button', { name: /run checks/i })).toBeDisabled();
  });

  it('disables Run Checks when password is empty', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });

    expect(screen.getByRole('button', { name: /run checks/i })).toBeDisabled();
  });

  it('disables Run Checks when both fields are whitespace-only', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: /run checks/i })).toBeDisabled();
  });

  it('enables Run Checks when both fields have content', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'StrongPass1!xx' },
    });

    expect(screen.getByRole('button', { name: /run checks/i })).toBeEnabled();
  });

  it('shows password length error when < 12 chars', async () => {
    renderStep();

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

    expect(mockHealthCheck).not.toHaveBeenCalled();
    expect(mockVercelSetEnv).not.toHaveBeenCalled();
  });

  // -- Cron & manual verification -----------------------------------------

  it('shows cron job verification note', () => {
    renderStep();

    expect(screen.getByText('Cron jobs')).toBeInTheDocument();
    expect(screen.getByText(/support-renewal-check/)).toBeInTheDocument();
    expect(screen.getByText(/report-agent-overage/)).toBeInTheDocument();
  });

  it('shows manual verification section', () => {
    renderStep();

    expect(screen.getByText('Manual verification (after setup):')).toBeInTheDocument();
    expect(screen.getByText('Stripe webhook test event fires and is received')).toBeInTheDocument();
    expect(screen.getByText(/CORS allows CMS/)).toBeInTheDocument();
    expect(screen.getByText('Session cookie works cross-subdomain')).toBeInTheDocument();
    expect(screen.getByText('Signup flow works end-to-end')).toBeInTheDocument();
  });

  // -- Health check flow — all pass ---------------------------------------

  it('sets env vars and runs health checks on Run Checks click', async () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'StrongPass1!xx' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getAllByText('HTTP 200')).toHaveLength(4);
    });

    expect(mockVercelSetEnv).toHaveBeenCalledWith(
      'tok_test',
      'prj-api-123',
      'REVEALUI_ADMIN_EMAIL',
      'admin@test.com',
    );
    expect(mockVercelSetEnv).toHaveBeenCalledWith(
      'tok_test',
      'prj-api-123',
      'REVEALUI_ADMIN_PASSWORD',
      'StrongPass1!xx',
    );
  });

  it('calls healthCheck with correct endpoint URLs based on domain', async () => {
    renderStep({ data: { domain: 'myapp.dev' } });

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(mockHealthCheck).toHaveBeenCalledTimes(4);
    });

    expect(mockHealthCheck).toHaveBeenCalledWith('https://api.myapp.dev/health/ready');
    expect(mockHealthCheck).toHaveBeenCalledWith('https://admin.myapp.dev');
    expect(mockHealthCheck).toHaveBeenCalledWith('https://myapp.dev');
    expect(mockHealthCheck).toHaveBeenCalledWith('https://api.myapp.dev/health/live');
  });

  it('runs all checks including email delivery on valid input', async () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('Gmail configured')).toBeInTheDocument();
    });

    expect(mockHealthCheck).toHaveBeenCalledTimes(4);
  });

  it('shows success message and enables Complete Setup when all pass', async () => {
    const { onComplete } = renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    const completeBtn = screen.getByRole('button', { name: /complete setup/i });
    expect(completeBtn).toBeEnabled();

    fireEvent.click(completeBtn);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('hides Run Checks button after all checks pass', async () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /run checks/i })).not.toBeInTheDocument();
  });

  it('disables inputs after all checks pass', async () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Admin Email')).toBeDisabled();
    expect(screen.getByLabelText('Admin Password')).toBeDisabled();
  });

  // -- Email delivery — Gmail provider ------------------------------------

  it('marks email as validated in email step when no Gmail credentials', async () => {
    renderStep({
      data: { emailProvider: 'gmail', googleServiceAccountEmail: '', googlePrivateKey: '' },
    });

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
  });

  // -- Health check flow — failures --------------------------------------

  it('marks individual checks as failed for non-2xx/3xx status', async () => {
    mockHealthCheck
      .mockResolvedValueOnce(503)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('HTTP 503')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /complete setup/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /run checks/i })).toBeInTheDocument();
  });

  it('handles rejected health check promises (network error)', async () => {
    mockHealthCheck
      .mockResolvedValueOnce(200)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /complete setup/i })).toBeDisabled();
  });

  it('handles rejected promise with non-Error reason', async () => {
    mockHealthCheck
      .mockResolvedValueOnce(200)
      .mockRejectedValueOnce('unknown failure')
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('Request failed')).toBeInTheDocument();
    });
  });

  it('treats HTTP 400+ as failure', async () => {
    mockHealthCheck.mockResolvedValue(404);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getAllByText('HTTP 404')).toHaveLength(4);
    });

    expect(screen.getByRole('button', { name: /complete setup/i })).toBeDisabled();
  });

  // -- Vercel env var edge cases ------------------------------------------

  it('skips env var push when no API project ID in config', async () => {
    renderStep({ config: { deploy: undefined } });

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    expect(mockVercelSetEnv).not.toHaveBeenCalled();
  });

  it('shows error when vercelSetEnv throws', async () => {
    mockVercelSetEnv.mockRejectedValue(new Error('Vercel API rate limit'));

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText('Vercel API rate limit')).toBeInTheDocument();
    });

    expect(mockHealthCheck).not.toHaveBeenCalled();
  });

  it('trims whitespace from email and password before sending', async () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: '  admin@test.com  ' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: '  MyPass!Strong  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(mockVercelSetEnv).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'REVEALUI_ADMIN_EMAIL',
        'admin@test.com',
      );
      expect(mockVercelSetEnv).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'REVEALUI_ADMIN_PASSWORD',
        'MyPass!Strong',
      );
    });
  });

  // -- HTTP status boundary -----------------------------------------------

  it('treats HTTP 301 redirect as pass (2xx-3xx range)', async () => {
    mockHealthCheck.mockResolvedValue(301);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'securepassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run checks/i }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });
  });
});
