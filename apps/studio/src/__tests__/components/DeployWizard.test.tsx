import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DeployWizard from '../../components/deploy/DeployWizard';
import type { StudioConfig } from '../../types';

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
};

vi.mock('../../hooks/use-config', () => ({
  useConfig: vi.fn().mockReturnValue({
    config: null,
    loading: true,
    error: null,
    updateConfig: vi.fn(),
    setIntent: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-deploy-wizard', () => ({
  useDeployWizard: vi.fn().mockReturnValue({
    steps: [
      { id: 'vercel', label: 'Connect Vercel' },
      { id: 'database', label: 'Provision Database' },
      { id: 'stripe', label: 'Connect Stripe' },
    ],
    currentStep: 0,
    step: { id: 'vercel', label: 'Connect Vercel' },
    isFirst: true,
    isLast: false,
    next: vi.fn(),
    back: vi.fn(),
    goTo: vi.fn(),
    markComplete: vi.fn(),
    isStepDone: vi.fn().mockReturnValue(false),
  }),
}));

// Mock all step components to keep test focused on orchestration
vi.mock('../../components/deploy/StepVercel', () => ({
  default: () => <div data-testid="step-vercel">StepVercel</div>,
}));
vi.mock('../../components/deploy/StepDatabase', () => ({
  default: () => <div data-testid="step-database">StepDatabase</div>,
}));
vi.mock('../../components/deploy/StepStripe', () => ({
  default: () => <div data-testid="step-stripe">StepStripe</div>,
}));
vi.mock('../../components/deploy/StepEmail', () => ({
  default: () => <div data-testid="step-email">StepEmail</div>,
}));
vi.mock('../../components/deploy/StepBlob', () => ({
  default: () => <div data-testid="step-blob">StepBlob</div>,
}));
vi.mock('../../components/deploy/StepSecrets', () => ({
  default: () => <div data-testid="step-secrets">StepSecrets</div>,
}));
vi.mock('../../components/deploy/StepDomain', () => ({
  default: () => <div data-testid="step-domain">StepDomain</div>,
}));
vi.mock('../../components/deploy/StepDeploy', () => ({
  default: () => <div data-testid="step-deploy">StepDeploy</div>,
}));
vi.mock('../../components/deploy/StepVerify', () => ({
  default: () => <div data-testid="step-verify">StepVerify</div>,
}));

const { useConfig } = await import('../../hooks/use-config');

describe('DeployWizard', () => {
  it('shows loading state when config is null', () => {
    render(<DeployWizard onComplete={vi.fn()} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders wizard title and step navigation when config is loaded', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: MOCK_CONFIG,
      loading: false,
      error: null,
      updateConfig: vi.fn(),
      setIntent: vi.fn(),
    });

    render(<DeployWizard onComplete={vi.fn()} />);

    expect(screen.getByText('Deploy RevealUI')).toBeInTheDocument();
    expect(screen.getByText('Connect Vercel')).toBeInTheDocument();
    expect(screen.getByText('Provision Database')).toBeInTheDocument();
    expect(screen.getByText('Connect Stripe')).toBeInTheDocument();
  });

  it('renders the current step component', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: MOCK_CONFIG,
      loading: false,
      error: null,
      updateConfig: vi.fn(),
      setIntent: vi.fn(),
    });

    render(<DeployWizard onComplete={vi.fn()} />);

    expect(screen.getByTestId('step-vercel')).toBeInTheDocument();
  });

  it('shows step counter', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: MOCK_CONFIG,
      loading: false,
      error: null,
      updateConfig: vi.fn(),
      setIntent: vi.fn(),
    });

    render(<DeployWizard onComplete={vi.fn()} />);

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('disables Back button on first step', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: MOCK_CONFIG,
      loading: false,
      error: null,
      updateConfig: vi.fn(),
      setIntent: vi.fn(),
    });

    render(<DeployWizard onComplete={vi.fn()} />);

    expect(screen.getByText('Back')).toBeDisabled();
  });
});
