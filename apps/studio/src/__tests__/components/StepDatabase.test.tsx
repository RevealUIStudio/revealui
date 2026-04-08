import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepDatabase from '../../components/deploy/StepDatabase';
import type { StudioConfig, WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  neonTestConnection: vi.fn().mockResolvedValue('ok'),
  runDbMigrate: vi.fn().mockResolvedValue('done'),
  runDbSeed: vi.fn().mockResolvedValue('done'),
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
  emailProvider: 'resend',
  blobToken: '',
  revealuiSecret: '',
  revealuiKek: '',
  cronSecret: '',
  domain: '',
  signupOpen: true,
};

describe('StepDatabase', () => {
  it('renders title and description', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Provision Database')).toBeInTheDocument();
    expect(screen.getByText('Set up your PostgreSQL database.')).toBeInTheDocument();
  });

  it('renders postgres URL input', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText('postgres://user:pass@host/db?sslmode=require'),
    ).toBeInTheDocument();
  });

  it('renders Supabase checkbox', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Enable AI features (requires Supabase)')).toBeInTheDocument();
  });

  it('shows Supabase fields when checkbox is checked', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Enable AI features (requires Supabase)'));

    expect(screen.getByPlaceholderText('https://your-project.supabase.co')).toBeInTheDocument();
  });

  it('Connect button is disabled when postgres URL is empty', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Connect & Migrate')).toBeDisabled();
  });

  it('Next button is disabled before database setup completes', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('enables Connect button when postgres URL is entered', () => {
    render(
      <StepDatabase
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('postgres://user:pass@host/db?sslmode=require'), {
      target: { value: 'postgres://user:pass@host/db' },
    });

    expect(screen.getByText('Connect & Migrate')).not.toBeDisabled();
  });
});
