/**
 * FormField wires a label, optional hint, and error to a single control.
 * aria-invalid and aria-describedby are set on that child so callers do not
 * hand-roll the relationship. Existing string hints stay hidden while an
 * error is shown unless keepDescription is set.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from '../../components/form-field.js';

describe('FormField', () => {
  it('renders a string description and points the control at it', () => {
    render(
      <FormField id="email" label="Email" description="We use this for receipts.">
        <input id="email" />
      </FormField>,
    );

    expect(screen.getByText('We use this for receipts.').tagName).toBe('P');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'email-description');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('shows a required-field error as a site message and marks the control invalid', () => {
    render(
      <FormField id="email" label="Email" required error="Email is required">
        <input id="email" />
      </FormField>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Email is required');
    expect(alert).toHaveAttribute('id', 'email-error');
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('hides helper text while an error is shown', () => {
    render(
      <FormField id="email" label="Email" description="Helper" error="Invalid email format">
        <input id="email" />
      </FormField>,
    );

    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('keeps a custom description beside the error and merges described-by ids', () => {
    render(
      <FormField
        id="password"
        label="Password"
        error="Password must be at least 12 characters long"
        keepDescription
        description={<span>Checklist</span>}
      >
        <input id="password" aria-describedby="extra" />
      </FormField>,
    );

    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Password must be at least 12 characters long',
    );
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      'extra password-description password-error',
    );
  });

  it('sets aria-invalid from the invalid prop when the hint is the message', () => {
    render(
      <FormField id="password" label="Password" invalid description={<span>Rules</span>}>
        <input id="password" />
      </FormField>,
    );

    expect(screen.getByText('Rules')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'password-description');
  });

  it('leaves multiple children unchanged and still shows the error', () => {
    render(
      <FormField id="email" label="Email" error="Email is required">
        <input id="email" />
        <span>extra</span>
      </FormField>,
    );

    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  });
});
