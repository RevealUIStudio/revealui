import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioConfig, WizardData } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHealthCheck = vi.fn<(url: string) => Promise<number>>();
const mockVercelSetEnv =
  vi.fn<(token: string, projectId: string, key: string, value: string) => Promise<void>>();

vi.mock('../../lib/deploy', () => ({
  healthCheck: (...args: unknown[]) => mockHealthCheck(...(args as [string])),
  vercelSetEnv: (...args: unknown[]) =>
    mockVercelSetEnv(...(args as [string, string, string, string])),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
  deploy: { apps: { api: 'prj-api-123', cms: 'prj-cms', marketing: 'prj-mkt' } },
};

const BASE_DATA: WizardData = {
  vercelToken: 'tok_test',
  vercelProjects: { api: '', cms: '', marketing: '' },
  postgresUrl: '',
  stripeSecretKey: '',
  stripePublishableKey: '',
  stripeWebhookSecret: '',
  stripePriceIds: { pro: '', max: '', enterprise: '' },
  licensePrivateKey: '',
  licensePublicKey: '',
  emailProvider: 'resend',
  blobToken: '',
  revealuiSecret: '',
  revealuiKek: '',
  cronSecret: '',
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

// Lazy import after mocks
const { default: StepVerify } = await import('../../components/deploy/StepVerify');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

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

  it('renders all four health check rows in idle state', () => {
    renderStep();

    expect(screen.getByText('API Health')).toBeInTheDocument();
    expect(screen.getByText('CMS')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Database (via API)')).toBeInTheDocument();
  });

  it('renders Run Checks button', () => {
    renderStep();

    expect(screen.getByRole('button', { name: 'Run Checks' })).toBeInTheDocument();
  });

  it('renders Complete Setup button (disabled by default)', () => {
    renderStep();

    const btn = screen.getByRole('button', { name: 'Complete Setup' });
    expect(btn).toBeDisabled();
  });

  // ── Validation ─────────────────────────────────────────────────────────

  it('disables Run Checks when email is empty', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'StrongPass1!' },
    });

    expect(screen.getByRole('button', { name: 'Run Checks' })).toBeDisabled();
  });

  it('disables Run Checks when password is empty', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });

    expect(screen.getByRole('button', { name: 'Run Checks' })).toBeDisabled();
  });

  it('disables Run Checks when both fields are whitespace-only', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Run Checks' })).toBeDisabled();
  });

  it('enables Run Checks when both fields have content', () => {
    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'StrongPass1!' },
    });

    expect(screen.getByRole('button', { name: 'Run Checks' })).toBeEnabled();
  });

  // ── Health check flow — all pass ───────────────────────────────────────

  it('sets env vars and runs health checks on Run Checks click', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getAllByText('HTTP 200')).toHaveLength(4);
    });

    // Verify env vars were pushed with trimmed values
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
      'StrongPass1!',
    );
  });

  it('calls healthCheck with correct endpoint URLs based on domain', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(200);

    renderStep({ data: { domain: 'myapp.dev' } });

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(mockHealthCheck).toHaveBeenCalledTimes(4);
    });

    expect(mockHealthCheck).toHaveBeenCalledWith('https://api.myapp.dev/health/ready');
    expect(mockHealthCheck).toHaveBeenCalledWith('https://cms.myapp.dev');
    expect(mockHealthCheck).toHaveBeenCalledWith('https://myapp.dev');
    expect(mockHealthCheck).toHaveBeenCalledWith('https://api.myapp.dev/health/live');
  });

  it('shows success message and enables Complete Setup when all pass', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(200);

    const { onComplete } = renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    const completeBtn = screen.getByRole('button', { name: 'Complete Setup' });
    expect(completeBtn).toBeEnabled();

    fireEvent.click(completeBtn);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('hides Run Checks button after all checks pass', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Run Checks' })).not.toBeInTheDocument();
  });

  it('disables inputs after all checks pass', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Admin Email')).toBeDisabled();
    expect(screen.getByLabelText('Admin Password')).toBeDisabled();
  });

  // ── Health check flow — failures ───────────────────────────────────────

  it('marks individual checks as failed for non-2xx/3xx status', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    // API returns 503, rest return 200
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
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText('HTTP 503')).toBeInTheDocument();
    });

    // 3 passed, 1 failed — Complete Setup stays disabled
    expect(screen.getByRole('button', { name: 'Complete Setup' })).toBeDisabled();
    // Run Checks still visible for retry
    expect(screen.getByRole('button', { name: 'Run Checks' })).toBeInTheDocument();
  });

  it('handles rejected health check promises (network error)', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
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
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Complete Setup' })).toBeDisabled();
  });

  it('handles rejected promise with non-Error reason', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
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
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText('Request failed')).toBeInTheDocument();
    });
  });

  it('treats HTTP 400+ as failure', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(404);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getAllByText('HTTP 404')).toHaveLength(4);
    });

    expect(screen.getByRole('button', { name: 'Complete Setup' })).toBeDisabled();
  });

  // ── Vercel env var edge cases ──────────────────────────────────────────

  it('skips env var push when no API project ID in config', async () => {
    mockHealthCheck.mockResolvedValue(200);

    renderStep({ config: { deploy: undefined } });

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

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
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText('Vercel API rate limit')).toBeInTheDocument();
    });

    // Health checks should NOT have run
    expect(mockHealthCheck).not.toHaveBeenCalled();
  });

  it('trims whitespace from email and password before sending', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(200);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: '  admin@test.com  ' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: '  MyPass!  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

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
        'MyPass!',
      );
    });
  });

  // ── HTTP status boundary ──────────────────────────────────────────────

  it('treats HTTP 301 redirect as pass (2xx-3xx range)', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue(301);

    renderStep();

    fireEvent.change(screen.getByLabelText('Admin Email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText('Admin Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Checks' }));

    await waitFor(() => {
      expect(screen.getByText(/All checks passed/)).toBeInTheDocument();
    });
  });
});
