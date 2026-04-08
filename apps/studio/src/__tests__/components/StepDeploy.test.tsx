import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StepDeploy from '../../components/deploy/StepDeploy';
import type { StudioConfig, WizardData } from '../../types';

const mockVercelSetEnv = vi.fn();
const mockVercelDeploy = vi.fn();
const mockVercelGetDeployment = vi.fn();

vi.mock('../../lib/deploy', () => ({
  vercelSetEnv: (...args: unknown[]) => mockVercelSetEnv(...args),
  vercelDeploy: (...args: unknown[]) => mockVercelDeploy(...args),
  vercelGetDeployment: (...args: unknown[]) => mockVercelGetDeployment(...args),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
  deploy: {
    supabaseEnabled: false,
    apps: { api: 'prj-api', admin: 'prj-admin', marketing: 'prj-mkt' },
  },
};

const MOCK_CONFIG_NO_IDS: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
  deploy: { supabaseEnabled: false },
};

const MOCK_DATA: WizardData = {
  vercelToken: 'tok_test',
  vercelProjects: { api: 'prj-api', admin: 'prj-admin', marketing: 'prj-mkt' },
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

describe('StepDeploy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 3 app cards (API, Admin, Marketing)', () => {
    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('shows Deploy All button', () => {
    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    expect(screen.getByText('Deploy All')).toBeInTheDocument();
  });

  it('disables Next until all apps are ready', () => {
    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('shows error if project IDs are missing', async () => {
    render(<StepDeploy config={MOCK_CONFIG_NO_IDS} data={MOCK_DATA} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Deploy All'));

    await waitFor(() => {
      expect(screen.getByText('Missing project IDs. Go back to Vercel step.')).toBeInTheDocument();
    });
  });

  it('deploys all apps and enables Next when ready', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockVercelDeploy.mockResolvedValue('mock-deploy-id');
    mockVercelGetDeployment.mockResolvedValue({
      id: 'mock',
      url: 'test.vercel.app',
      state: 'READY',
      createdAt: 0,
    });

    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Deploy All'));

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    // All 3 apps should show the deployed URL
    const urls = screen.getAllByText('test.vercel.app');
    expect(urls).toHaveLength(3);
  });

  it('shows error state when deployment fails', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockVercelDeploy.mockRejectedValue(new Error('Deploy crashed'));

    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Deploy All'));

    await waitFor(() => {
      expect(screen.getByText(/deployment\(s\) failed/)).toBeInTheDocument();
    });

    // Retry button appears on failure
    expect(screen.getByText('Retry Failed')).toBeInTheDocument();
  });

  it('builds API env vars with Supabase when provided', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockVercelDeploy.mockResolvedValue('mock-deploy-id');
    mockVercelGetDeployment.mockResolvedValue({
      id: 'mock',
      url: 'test.vercel.app',
      state: 'READY',
      createdAt: 0,
    });

    const dataWithSupabase: WizardData = {
      ...MOCK_DATA,
      supabaseUrl: 'https://abc.supabase.co',
      supabasePublishableKey: 'anon_key_123',
      supabaseSecretKey: 'service_key_123',
    };

    render(<StepDeploy config={MOCK_CONFIG} data={dataWithSupabase} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Deploy All'));

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    // Check that Supabase vars were pushed for the API app
    const setEnvCalls = mockVercelSetEnv.mock.calls;
    const apiSupabaseCalls = setEnvCalls.filter(
      (c: unknown[]) => c[1] === 'prj-api' && (c[2] as string).includes('SUPABASE'),
    );
    expect(apiSupabaseCalls).toHaveLength(3); // URL, ANON_KEY, SERVICE_ROLE_KEY

    // Check Admin also gets Supabase URL + anon key
    const adminSupabaseCalls = setEnvCalls.filter(
      (c: unknown[]) => c[1] === 'prj-admin' && (c[2] as string).includes('SUPABASE'),
    );
    expect(adminSupabaseCalls).toHaveLength(2); // URL, ANON_KEY
  });

  it('builds Admin env vars with email (resend) and signup control', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockVercelDeploy.mockResolvedValue('mock-deploy-id');
    mockVercelGetDeployment.mockResolvedValue({
      id: 'mock',
      url: 'test.vercel.app',
      state: 'READY',
      createdAt: 0,
    });

    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Deploy All'));

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    const setEnvCalls = mockVercelSetEnv.mock.calls;

    // Admin should have RESEND_API_KEY
    const adminResend = setEnvCalls.find(
      (c: unknown[]) => c[1] === 'prj-admin' && c[2] === 'RESEND_API_KEY',
    );
    expect(adminResend).toBeDefined();
    expect(adminResend?.[3]).toBe('rk_test_123');

    // Admin should have REVEALUI_SIGNUP_OPEN
    const adminSignup = setEnvCalls.find(
      (c: unknown[]) => c[1] === 'prj-admin' && c[2] === 'REVEALUI_SIGNUP_OPEN',
    );
    expect(adminSignup).toBeDefined();
    expect(adminSignup?.[3]).toBe('true');
  });

  it('builds Admin env vars with SMTP email provider', async () => {
    mockVercelSetEnv.mockResolvedValue(undefined);
    mockVercelDeploy.mockResolvedValue('mock-deploy-id');
    mockVercelGetDeployment.mockResolvedValue({
      id: 'mock',
      url: 'test.vercel.app',
      state: 'READY',
      createdAt: 0,
    });

    const smtpData: WizardData = {
      ...MOCK_DATA,
      emailProvider: 'smtp',
      resendApiKey: undefined,
      smtpHost: 'smtp.example.com',
      smtpPort: '587',
      smtpUser: 'user@example.com',
      smtpPass: 'smtp_pass',
    };

    render(<StepDeploy config={MOCK_CONFIG} data={smtpData} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Deploy All'));

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    const setEnvCalls = mockVercelSetEnv.mock.calls;

    // Admin should have SMTP vars
    const adminSmtpHost = setEnvCalls.find(
      (c: unknown[]) => c[1] === 'prj-admin' && c[2] === 'SMTP_HOST',
    );
    expect(adminSmtpHost).toBeDefined();
    expect(adminSmtpHost?.[3]).toBe('smtp.example.com');

    const adminSmtpPort = setEnvCalls.find(
      (c: unknown[]) => c[1] === 'prj-admin' && c[2] === 'SMTP_PORT',
    );
    expect(adminSmtpPort).toBeDefined();
    expect(adminSmtpPort?.[3]).toBe('587');

    // Admin should NOT have RESEND_API_KEY with smtp provider
    const adminResend = setEnvCalls.find(
      (c: unknown[]) => c[1] === 'prj-admin' && c[2] === 'RESEND_API_KEY',
    );
    expect(adminResend).toBeUndefined();
  });
});
