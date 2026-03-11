/**
 * Textarea Headless Component Tests
 *
 * Tests the headless Textarea component for rendering, ref forwarding,
 * disabled/invalid states, and resize behavior.
 */

import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Textarea } from '../../components/textarea-headless.js';

describe('Textarea', () => {
  it('should render a textarea element', () => {
    render(<Textarea />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('should forward ref to the textarea element', () => {
    const ref = createRef<HTMLTextAreaElement>();

    render(<Textarea ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should set data-disabled when disabled', () => {
    render(<Textarea disabled />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('data-disabled', '');
    expect(textarea).toBeDisabled();
  });

  it('should set data-invalid when invalid', () => {
    render(<Textarea invalid />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('data-invalid', '');
  });

  it('should be resizable by default with resize-y class', () => {
    render(<Textarea />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('resize-y');
  });

  it('should apply resize-none class when resizable is false', () => {
    render(<Textarea resizable={false} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('resize-none');
  });

  it('should wrap textarea in a span with data-slot="control"', () => {
    const { container } = render(<Textarea />);

    const wrapper = container.querySelector('span[data-slot="control"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.querySelector('textarea')).toBeInTheDocument();
  });

  it('should render placeholder text', () => {
    render(<Textarea placeholder="Write something..." />);

    expect(screen.getByPlaceholderText('Write something...')).toBeInTheDocument();
  });
});
