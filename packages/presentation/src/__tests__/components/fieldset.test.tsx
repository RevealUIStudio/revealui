/**
 * Fieldset Component Tests
 *
 * Tests the Fieldset compound component including Fieldset, Legend,
 * FieldGroup, Field, Label, Description, and ErrorMessage.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label,
  Legend,
} from '../../components/fieldset.js';

describe('Fieldset', () => {
  it('should render a fieldset element', () => {
    render(<Fieldset data-testid="fs">Content</Fieldset>);
    expect(screen.getByTestId('fs').tagName).toBe('FIELDSET');
  });

  it('should render children', () => {
    render(<Fieldset>Child content</Fieldset>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <Fieldset className="custom" data-testid="fs">
        Content
      </Fieldset>,
    );
    expect(screen.getByTestId('fs')).toHaveClass('custom');
  });

  it('should set disabled attribute when disabled', () => {
    render(
      <Fieldset disabled data-testid="fs">
        Content
      </Fieldset>,
    );
    const fieldset = screen.getByTestId('fs') as HTMLFieldSetElement;
    expect(fieldset.disabled).toBe(true);
  });
});

describe('Legend', () => {
  it('should render a legend element', () => {
    render(
      <Fieldset>
        <Legend>Account Settings</Legend>
      </Fieldset>,
    );
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('Account Settings').tagName).toBe('LEGEND');
  });

  it('should have data-slot="legend"', () => {
    render(
      <Fieldset>
        <Legend>Settings</Legend>
      </Fieldset>,
    );
    expect(screen.getByText('Settings')).toHaveAttribute('data-slot', 'legend');
  });
});

describe('FieldGroup', () => {
  it('should render a div with data-slot="control"', () => {
    render(<FieldGroup data-testid="fg">Fields here</FieldGroup>);
    const el = screen.getByTestId('fg');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveAttribute('data-slot', 'control');
  });
});

describe('Field', () => {
  it('should render a div container', () => {
    render(<Field data-testid="field">Field content</Field>);
    expect(screen.getByTestId('field').tagName).toBe('DIV');
  });

  it('should set data-disabled when disabled', () => {
    render(
      <Field disabled data-testid="field">
        Content
      </Field>,
    );
    expect(screen.getByTestId('field')).toHaveAttribute('data-disabled', '');
  });

  it('should not set data-disabled when not disabled', () => {
    render(<Field data-testid="field">Content</Field>);
    expect(screen.getByTestId('field')).not.toHaveAttribute('data-disabled');
  });
});

describe('Label (fieldset)', () => {
  it('should render a label element', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username').tagName).toBe('LABEL');
  });

  it('should have data-slot="label"', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toHaveAttribute('data-slot', 'label');
  });
});

describe('Description', () => {
  it('should render a p element', () => {
    render(<Description>Help text</Description>);
    expect(screen.getByText('Help text').tagName).toBe('P');
  });

  it('should have data-slot="description"', () => {
    render(<Description>Help text</Description>);
    expect(screen.getByText('Help text')).toHaveAttribute('data-slot', 'description');
  });
});

describe('ErrorMessage', () => {
  it('should render a p element', () => {
    render(<ErrorMessage>Required field</ErrorMessage>);
    expect(screen.getByText('Required field').tagName).toBe('P');
  });

  it('should have data-slot="error"', () => {
    render(<ErrorMessage>Required field</ErrorMessage>);
    expect(screen.getByText('Required field')).toHaveAttribute('data-slot', 'error');
  });
});
