import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Input from '../../components/ui/Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Username" id="username" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('renders hint when provided alongside label', () => {
    render(<Input label="Passphrase" hint="optional" id="passphrase" />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('does not render hint without label', () => {
    render(<Input hint="optional" />);
    expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
  });

  it('applies mono font class when mono prop is true', () => {
    render(<Input mono />);
    expect(screen.getByRole('textbox').className).toContain('font-mono');
  });

  it('does not apply mono font by default', () => {
    render(<Input />);
    expect(screen.getByRole('textbox').className).not.toContain('font-mono');
  });

  it('forwards HTML input attributes', () => {
    render(<Input type="email" placeholder="Enter email" required />);
    const input = screen.getByPlaceholderText('Enter email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
  });

  it('handles value changes', () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('associates label with input via id', () => {
    render(<Input label="Email" id="email-input" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'email-input');
  });
});
