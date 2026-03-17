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

  it('should render optional header slot above children', () => {
    render(
      <AuthLayout header={<div data-testid="header">Logo</div>}>
        <p data-testid="child">Form</p>
      </AuthLayout>,
    );
    const header = screen.getByTestId('header');
    const child = screen.getByTestId('child');
    expect(header).toBeInTheDocument();
    // Header should appear before the child in the DOM
    expect(header.compareDocumentPosition(child)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('should render optional footer slot below children', () => {
    render(
      <AuthLayout footer={<div data-testid="footer">Learn more</div>}>
        <p data-testid="child">Form</p>
      </AuthLayout>,
    );
    const child = screen.getByTestId('child');
    const footer = screen.getByTestId('footer');
    expect(footer).toBeInTheDocument();
    // Footer should appear after the child in the DOM
    expect(footer.compareDocumentPosition(child)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });

  it('should not render header or footer when not provided', () => {
    const { container } = render(
      <AuthLayout>
        <p>Form</p>
      </AuthLayout>,
    );
    // Only the child <p> should be inside the centered container
    const main = container.querySelector('main');
    const centeredDiv = main?.firstElementChild;
    expect(centeredDiv?.children).toHaveLength(1);
  });
});
