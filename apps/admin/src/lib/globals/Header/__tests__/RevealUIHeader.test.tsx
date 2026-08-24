import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
  }: {
    href: string;
    prefetch?: boolean;
    children: React.ReactNode;
  }) => (
    <a href={href} data-prefetch={prefetch === undefined ? 'default' : String(prefetch)}>
      {children}
    </a>
  ),
}));

vi.mock('@revealui/presentation/server', () => ({
  RevealUIWordmark: () => <span>RevealUI</span>,
}));

vi.mock('@/components/revealui/sections', () => ({
  NavbarWithLinksActionsAndCenteredLogo: ({ actions }: { actions: React.ReactNode }) => (
    <header>{actions}</header>
  ),
  NavbarLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  NavbarLogo: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { RevealUIHeader } from '../RevealUIHeader';

afterEach(() => {
  cleanup();
});

describe('RevealUIHeader login action', () => {
  it('does not prefetch bare /login (signed-in cookies 307 that request to /)', () => {
    render(<RevealUIHeader header={{ id: 'header', navItems: [] }} />);

    const login = screen.getByRole('link', { name: 'Log in' });
    expect(login).toHaveAttribute('href', '/login');
    expect(login).toHaveAttribute('data-prefetch', 'false');
  });
});
