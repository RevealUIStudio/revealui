/**
 * Input Headless Component Tests
 *
 * Tests the headless Input and InputGroup components for rendering,
 * ref forwarding, disabled/invalid states, and type propagation.
 */

import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Input, InputGroup } from '../../components/input-headless.js';

describe('Input', () => {
  it('should render an input element', () => {
    render(<Input />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should forward ref to the input element', () => {
    const ref = createRef<HTMLInputElement>();

    render(<Input ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should set data-disabled when disabled', () => {
    render(<Input disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('data-disabled', '');
    expect(input).toBeDisabled();
  });

  it('should set data-invalid when invalid', () => {
    render(<Input invalid />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('data-invalid', '');
  });

  it('should wrap input in a span with data-slot="control"', () => {
    const { container } = render(<Input />);

    const wrapper = container.querySelector('span[data-slot="control"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.querySelector('input')).toBeInTheDocument();
  });

  it('should pass type prop through', () => {
    render(<Input type="email" data-testid="email-input" />);

    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should render placeholder text', () => {
    render(<Input placeholder="Enter your name" />);

    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
  });
});

describe('InputGroup', () => {
  it('should render a span with data-slot="control"', () => {
    const { container } = render(
      <InputGroup>
        <Input />
      </InputGroup>,
    );

    const group = container.querySelector(':scope > span[data-slot="control"]');
    expect(group).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <InputGroup>
        <span data-testid="child">Child</span>
      </InputGroup>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
