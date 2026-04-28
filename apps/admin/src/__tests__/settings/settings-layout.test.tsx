import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock usePathname to return the account page path
const mockPathname = vi.fn(() => '/settings/account');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => mockPathname(),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link to render a regular anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import SettingsLayout from '../../app/(backend)/settings/layout';

describe('SettingsLayout', () => {
  it('renders sidebar with navigation links', () => {
    render(
      <SettingsLayout>
        <div data-testid="child-content">Page content</div>
      </SettingsLayout>,
    );

    const sidebar = screen.getByRole('complementary');
    expect(within(sidebar).getByText('Back to Admin')).toBeInTheDocument();
    expect(within(sidebar).getByText('Settings')).toBeInTheDocument();
    expect(within(sidebar).getByText('Account')).toBeInTheDocument();
    expect(within(sidebar).getByText('API Keys')).toBeInTheDocument();
  });

  it('renders children in the content area', () => {
    render(
      <SettingsLayout>
        <div data-testid="child-content">Page content</div>
      </SettingsLayout>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('links back to admin dashboard', () => {
    render(
      <SettingsLayout>
        <div>Content</div>
      </SettingsLayout>,
    );

    const sidebar = screen.getByRole('complementary');
    const backLink = within(sidebar).getByText('Back to Admin');
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('links Account to /settings/account', () => {
    render(
      <SettingsLayout>
        <div>Content</div>
      </SettingsLayout>,
    );

    const sidebar = screen.getByRole('complementary');
    const accountLink = within(sidebar).getByText('Account');
    expect(accountLink.closest('a')).toHaveAttribute('href', '/settings/account');
  });

  it('links API Keys to /settings/api-keys', () => {
    render(
      <SettingsLayout>
        <div>Content</div>
      </SettingsLayout>,
    );

    const sidebar = screen.getByRole('complementary');
    const apiKeysLink = within(sidebar).getByText('API Keys');
    expect(apiKeysLink.closest('a')).toHaveAttribute('href', '/settings/api-keys');
  });

  it('highlights active Account link', () => {
    mockPathname.mockReturnValue('/settings/account');

    render(
      <SettingsLayout>
        <div>Content</div>
      </SettingsLayout>,
    );

    const sidebar = screen.getByRole('complementary');
    const accountLink = within(sidebar).getByText('Account').closest('a');
    expect(accountLink?.className).toContain('bg-zinc-800');
    expect(accountLink?.className).toContain('text-white');
  });

  it('highlights active API Keys link', () => {
    mockPathname.mockReturnValue('/settings/api-keys');

    render(
      <SettingsLayout>
        <div>Content</div>
      </SettingsLayout>,
    );

    const sidebar = screen.getByRole('complementary');
    const apiKeysLink = within(sidebar).getByText('API Keys').closest('a');
    expect(apiKeysLink?.className).toContain('bg-zinc-800');
    expect(apiKeysLink?.className).toContain('text-white');

    // Account should NOT be highlighted
    const accountLink = within(sidebar).getByText('Account').closest('a');
    expect(accountLink?.className).not.toContain('bg-zinc-800');
  });
});
