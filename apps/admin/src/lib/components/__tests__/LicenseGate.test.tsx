import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useLicense provider
const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

// Mock UpgradePrompt
vi.mock('../../../components/UpgradePrompt', () => ({
  UpgradePrompt: ({ feature }: { feature: string }) => (
    <div data-testid="upgrade-prompt">Upgrade required for {feature}</div>
  ),
}));

import { LicenseGate } from '../LicenseGate';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LicenseGate', () => {
  const childContent = 'Protected content';

  describe('loading state', () => {
    it('shows spinner while license is loading', () => {
      mockUseLicense.mockReturnValue({ features: null, isLoading: true });
      render(
        <LicenseGate feature="ai">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      expect(screen.queryByText(childContent)).not.toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('when feature is enabled', () => {
    beforeEach(() => {
      mockUseLicense.mockReturnValue({
        features: { ai: true, mcp: false },
        isLoading: false,
      });
    });

    it('renders children when the feature flag is true', () => {
      render(
        <LicenseGate feature="ai">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      expect(screen.getByText(childContent)).toBeInTheDocument();
      expect(screen.queryByTestId('upgrade-prompt')).not.toBeInTheDocument();
    });
  });

  describe('when feature is disabled', () => {
    beforeEach(() => {
      mockUseLicense.mockReturnValue({
        features: { ai: false, mcp: false },
        isLoading: false,
      });
    });

    it('shows UpgradePrompt in inline mode (default)', () => {
      render(
        <LicenseGate feature="ai">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      expect(screen.queryByText(childContent)).not.toBeInTheDocument();
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
      expect(screen.getByText('Upgrade required for ai')).toBeInTheDocument();
    });

    it('shows blurred children with overlay in dialog mode', () => {
      render(
        <LicenseGate feature="ai" mode="dialog">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      // Children are rendered but blurred behind overlay
      expect(screen.getByText(childContent)).toBeInTheDocument();
      const blurredContainer = screen.getByText(childContent).closest('.blur-sm');
      expect(blurredContainer).toBeInTheDocument();
      expect(blurredContainer).toHaveAttribute('aria-hidden', 'true');

      // Upgrade prompt is shown on top
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
    });
  });

  describe('when features object is null/undefined', () => {
    it('treats missing feature as disabled', () => {
      mockUseLicense.mockReturnValue({ features: null, isLoading: false });
      render(
        <LicenseGate feature="ai">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      expect(screen.queryByText(childContent)).not.toBeInTheDocument();
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
    });

    it('treats undefined features map as disabled', () => {
      mockUseLicense.mockReturnValue({ features: undefined, isLoading: false });
      render(
        <LicenseGate feature="ai">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
    });
  });

  describe('when feature key is missing from map', () => {
    it('treats absent key as disabled', () => {
      mockUseLicense.mockReturnValue({
        features: { mcp: true },
        isLoading: false,
      });
      render(
        <LicenseGate feature="ai">
          <p>{childContent}</p>
        </LicenseGate>,
      );
      expect(screen.queryByText(childContent)).not.toBeInTheDocument();
      expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
    });
  });
});
