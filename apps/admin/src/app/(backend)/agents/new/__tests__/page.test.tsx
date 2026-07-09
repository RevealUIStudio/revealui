import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import NewAgentPage from '../page';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLicense.mockReturnValue({ features: { ai: true }, isLoading: false });
});

describe('NewAgentPage', () => {
  it('never defaults a template to a hardcoded Claude model id', () => {
    render(<NewAgentPage />);

    for (const label of ['Content Writer', 'Code Assistant', 'Support Agent', 'Data Analyst']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
      expect(
        screen.getByText(/Auto \(resolved from your configured provider\)/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/claude-/)).not.toBeInTheDocument();
    }
  });

  it('links to Settings, API Keys for provider configuration', () => {
    render(<NewAgentPage />);
    fireEvent.click(screen.getByRole('button', { name: /Content Writer/ }));

    const link = screen.getByRole('link', { name: 'Settings, API Keys' });
    expect(link).toHaveAttribute('href', '/settings/api-keys');
  });
});
