import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepVercel from '../../components/deploy/StepVercel';
import type { StudioConfig, WizardData } from '../../types';

const mockVercelValidateToken = vi.fn();
const mockVercelCreateProject = vi.fn();

vi.mock('../../lib/deploy', () => ({
  vercelValidateToken: (...args: unknown[]) => mockVercelValidateToken(...args),
  vercelCreateProject: (...args: unknown[]) => mockVercelCreateProject(...args),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
  deploy: { supabaseEnabled: false },
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

describe('StepVercel', () => {
  it('renders token input and validate button', () => {
    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Enter your Vercel API token')).toBeInTheDocument();
    expect(screen.getByText('Validate Token')).toBeInTheDocument();
  });

  it('disables Validate button when token is empty', () => {
    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Validate Token')).toBeDisabled();
  });

  it('disables Next button until validated', () => {
    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('creates missing projects after validation', async () => {
    mockVercelValidateToken.mockResolvedValue([
      { id: 'existing-admin', name: 'revealui-admin', framework: 'nextjs', accountId: 'team-abc' },
    ]);
    mockVercelCreateProject
      .mockResolvedValueOnce({
        id: 'new-api',
        name: 'revealui-api',
        framework: 'other',
        accountId: 'team-abc',
      })
      .mockResolvedValueOnce({
        id: 'new-marketing',
        name: 'revealui-marketing',
        framework: 'nextjs',
        accountId: 'team-abc',
      });

    const onUpdateData = vi.fn();
    const onUpdateConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={onUpdateData}
        onUpdateConfig={onUpdateConfig}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter your Vercel API token'), {
      target: { value: 'test-token' },
    });
    fireEvent.click(screen.getByText('Validate Token'));

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    // Should have created api and marketing (admin already existed)
    expect(mockVercelCreateProject).toHaveBeenCalledTimes(2);
    expect(mockVercelCreateProject).toHaveBeenCalledWith(
      'test-token',
      'revealui-api',
      'other',
      'apps/api',
    );
    expect(mockVercelCreateProject).toHaveBeenCalledWith(
      'test-token',
      'revealui-marketing',
      'nextjs',
      'apps/marketing',
    );

    // Should update data with project IDs
    expect(onUpdateData).toHaveBeenCalledWith({
      vercelToken: 'test-token',
      vercelProjects: { api: 'new-api', admin: 'existing-admin', marketing: 'new-marketing' },
    });

    // Should update config with teamId
    expect(onUpdateConfig).toHaveBeenCalledWith({
      deploy: expect.objectContaining({
        vercelTeamId: 'team-abc',
        apps: { api: 'new-api', admin: 'existing-admin', marketing: 'new-marketing' },
      }),
    });
  });

  it('reuses existing projects when names match', async () => {
    mockVercelValidateToken.mockResolvedValue([
      { id: 'id-api', name: 'revealui-api', framework: 'other', accountId: 'team-xyz' },
      { id: 'id-admin', name: 'revealui-admin', framework: 'nextjs', accountId: 'team-xyz' },
      { id: 'id-mkt', name: 'revealui-marketing', framework: 'nextjs', accountId: 'team-xyz' },
    ]);
    mockVercelCreateProject.mockClear();

    const onUpdateData = vi.fn();
    const onUpdateConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={onUpdateData}
        onUpdateConfig={onUpdateConfig}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter your Vercel API token'), {
      target: { value: 'test-token' },
    });
    fireEvent.click(screen.getByText('Validate Token'));

    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    // Should NOT call create for any project
    expect(mockVercelCreateProject).not.toHaveBeenCalled();

    // Should update data with existing project IDs
    expect(onUpdateData).toHaveBeenCalledWith({
      vercelToken: 'test-token',
      vercelProjects: { api: 'id-api', admin: 'id-admin', marketing: 'id-mkt' },
    });
  });
});
