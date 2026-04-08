import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepDomain from '../../components/deploy/StepDomain';
import type { StudioConfig, WizardData } from '../../types';

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
  emailProvider: 'resend',
  blobToken: '',
  revealuiSecret: '',
  revealuiKek: '',
  cronSecret: '',
  domain: '',
  signupOpen: true,
};

describe('StepDomain', () => {
  it('renders title and description', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Domain & CORS')).toBeInTheDocument();
    expect(screen.getByText('Configure your domain and security settings.')).toBeInTheDocument();
  });

  it('renders domain input and signup checkbox', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Allow public signups (REVEALUI_SIGNUP_OPEN)')).toBeInTheDocument();
  });

  it('shows derived URLs when domain is entered', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'mysite.com' },
    });

    expect(screen.getByText('https://api.mysite.com')).toBeInTheDocument();
    expect(screen.getByText('https://admin.mysite.com')).toBeInTheDocument();
    expect(screen.getByText('https://mysite.com')).toBeInTheDocument();
  });

  it('Save button is disabled when domain is empty', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Save Configuration')).toBeDisabled();
  });

  it('Next button is disabled before saving', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('shows DNS records table when domain is entered', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'test.com' },
    });

    expect(screen.getByText('DNS Records')).toBeInTheDocument();
    // Three CNAME records (api, admin, marketing) all point to vercel
    const cnameValues = screen.getAllByText('cname.vercel-dns.com');
    expect(cnameValues).toHaveLength(3);
  });

  it('renders optional brand fields', () => {
    render(
      <StepDomain
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('user@example.com, admin@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('#ea580c')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com/logo.png')).toBeInTheDocument();
  });
});
