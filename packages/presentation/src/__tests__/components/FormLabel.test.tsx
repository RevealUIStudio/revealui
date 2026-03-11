/**
 * FormLabel Component Tests
 *
 * Tests the FormLabel component which wraps Label with
 * optional required indicator.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormLabel } from '../../components/FormLabel.js';

describe('FormLabel', () => {
  it('should render a label element', () => {
    render(<FormLabel>Username</FormLabel>);
    expect(screen.getByText('Username').closest('label')).toBeInTheDocument();
  });

  it('should render children text', () => {
    render(<FormLabel>Email address</FormLabel>);
    expect(screen.getByText('Email address')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<FormLabel className="custom-label">Name</FormLabel>);
    const label = screen.getByText('Name').closest('label');
    expect(label).toHaveClass('custom-label');
  });

  it('should forward htmlFor prop', () => {
    render(<FormLabel htmlFor="email-input">Email</FormLabel>);
    const label = screen.getByText('Email').closest('label');
    expect(label).toHaveAttribute('for', 'email-input');
  });

  it('should render required asterisk when required is true', () => {
    render(<FormLabel required>Password</FormLabel>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should not render asterisk when required is false', () => {
    render(<FormLabel>Optional field</FormLabel>);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('should have displayName set to FormLabel', () => {
    expect(FormLabel.displayName).toBe('FormLabel');
  });
});
