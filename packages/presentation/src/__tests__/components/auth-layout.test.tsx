/**
 * AuthLayout Component Tests
 *
 * Tests the AuthLayout component which provides a centered layout
 * for authentication pages (login, register, etc.).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthLayout } from '../../components/auth-layout.js';

describe('AuthLayout', () => {
  it('should render a main element', () => {
    render(
      <AuthLayout>
        <p>Login form</p>
      </AuthLayout>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <AuthLayout>
        <p>Login form content</p>
      </AuthLayout>,
    );
    expect(screen.getByText('Login form content')).toBeInTheDocument();
  });

  it('should have centered layout classes', () => {
    render(
      <AuthLayout>
        <p>Content</p>
      </AuthLayout>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex', 'min-h-dvh', 'flex-col');
  });

  it('should wrap children in a centered container', () => {
    render(
      <AuthLayout>
        <p data-testid="child">Child content</p>
      </AuthLayout>,
    );
    const child = screen.getByTestId('child');
    const container = child.parentElement;
    expect(container).toHaveClass('items-center', 'justify-center');
  });
});
