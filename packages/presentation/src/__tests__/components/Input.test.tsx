/**
 * Input Component Tests
 *
 * Tests for the Input form component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '../../components/Input.js';

describe('Input', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter text" />);

      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should render with value', () => {
      render(<Input value="Test value" onChange={vi.fn()} />);

      expect(screen.getByDisplayValue('Test value')).toBeInTheDocument();
    });

    it('should render with default value', () => {
      render(<Input defaultValue="Default text" />);

      expect(screen.getByDisplayValue('Default text')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<Input className="custom-input" />);

      const input = container.querySelector('input');
      expect(input).toHaveClass('custom-input');
    });
  });

  describe('Input Types', () => {
    it('should render as textbox by default', () => {
      render(<Input />);

      // Input renders as textbox role without explicit type attribute
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should accept type="email"', () => {
      render(<Input type="email" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should accept type="password"', () => {
      render(<Input type="password" />);

      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it('should accept type="number"', () => {
      render(<Input type="number" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should accept type="tel"', () => {
      render(<Input type="tel" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'tel');
    });

    it('should accept type="url"', () => {
      render(<Input type="url" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'url');
    });

    it('should accept type="search"', () => {
      render(<Input type="search" />);

      const input = screen.getByRole('searchbox');
      expect(input).toHaveAttribute('type', 'search');
    });
  });

  describe('User Interaction', () => {
    it('should handle onChange events', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');

      expect(handleChange).toHaveBeenCalled();
      expect(handleChange).toHaveBeenCalledTimes(5); // Called for each character
    });

    it('should update value when typing', async () => {
      const user = userEvent.setup();

      render(<Input />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.type(input, 'New text');

      expect(input.value).toBe('New text');
    });

    it('should handle focus events', async () => {
      const handleFocus = vi.fn();
      const user = userEvent.setup();

      render(<Input onFocus={handleFocus} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(handleFocus).toHaveBeenCalledOnce();
    });

    it('should handle blur events', async () => {
      const handleBlur = vi.fn();
      const user = userEvent.setup();

      render(<Input onBlur={handleBlur} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.tab();

      expect(handleBlur).toHaveBeenCalledOnce();
    });

    it('should clear input value', async () => {
      const user = userEvent.setup();

      render(<Input defaultValue="Initial value" />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.clear(input);

      expect(input.value).toBe('');
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should not accept input when disabled', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input disabled onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('should have disabled styling', () => {
      const { container } = render(<Input disabled />);

      const input = container.querySelector('input');
      expect(input).toHaveClass('disabled:cursor-not-allowed');
      expect(input).toHaveClass('disabled:opacity-50');
    });
  });

  describe('Read-Only State', () => {
    it('should be read-only when readOnly prop is true', () => {
      render(<Input readOnly value="Read only text" onChange={vi.fn()} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readOnly');
    });

    it('should not accept input when read-only', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input readOnly value="Initial" onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Test');

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Required Field', () => {
    it('should have required attribute when required prop is true', () => {
      render(<Input required />);

      expect(screen.getByRole('textbox')).toHaveAttribute('required');
    });

    it('should validate in form context', () => {
      render(
        <form>
          <Input required />
        </form>,
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.validity.valid).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should accept pattern attribute', () => {
      render(<Input pattern="[0-9]+" />);

      expect(screen.getByRole('textbox')).toHaveAttribute('pattern', '[0-9]+');
    });

    it('should accept minLength attribute', () => {
      render(<Input minLength={5} />);

      expect(screen.getByRole('textbox')).toHaveAttribute('minLength', '5');
    });

    it('should accept maxLength attribute', () => {
      render(<Input maxLength={10} />);

      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10');
    });

    it('should enforce maxLength', async () => {
      const user = userEvent.setup();

      render(<Input maxLength={5} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.type(input, 'ThisIsLongerThanFive');

      expect(input.value).toHaveLength(5);
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Input aria-label="Username input" />);

      expect(screen.getByLabelText('Username input')).toBeInTheDocument();
    });

    it('should support aria-describedby', () => {
      render(
        <>
          <Input aria-describedby="help-text" />
          <div id="help-text">Help text</div>
        </>,
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should support aria-invalid', () => {
      render(<Input aria-invalid="true" />);

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should be keyboard navigable', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('tabindex', '-1');
    });

    it('should receive focus when tabbed', async () => {
      const user = userEvent.setup();

      render(<Input />);

      const input = screen.getByRole('textbox');
      await user.tab();

      expect(input).toHaveFocus();
    });
  });

  describe('Forwarded Ref', () => {
    it('should forward ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null };

      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('should allow ref access to input methods', () => {
      const ref = { current: null as HTMLInputElement | null };

      render(<Input ref={ref} defaultValue="test" />);

      expect(ref.current?.value).toBe('test');
      expect(ref.current?.tagName).toBe('INPUT');
    });
  });

  describe('Edge Cases', () => {
    it('should handle long text', async () => {
      const longText = 'A'.repeat(50);
      const user = userEvent.setup();

      render(<Input />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.type(input, longText);

      expect(input.value).toHaveLength(50);
    });

    it('should handle special characters', async () => {
      const user = userEvent.setup();
      const specialChars = '!@#$%';

      render(<Input />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.type(input, specialChars);

      expect(input.value).toBe(specialChars);
    });

    it('should handle empty string value', () => {
      render(<Input value="" onChange={vi.fn()} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle undefined value', () => {
      render(<Input value={undefined} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should handle typing', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Hello');

      expect(handleChange).toHaveBeenCalledTimes(5);
    });
  });

  describe('Number Input', () => {
    it('should accept number type with min and max', () => {
      render(<Input type="number" min={0} max={100} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('should accept step attribute', () => {
      render(<Input type="number" step={0.1} />);

      expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.1');
    });
  });

  describe('File Input', () => {
    it('should render file input', () => {
      render(<Input type="file" />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });

    it('should accept file input attributes', () => {
      render(<Input type="file" accept=".jpg,.png" multiple />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', '.jpg,.png');
      expect(input).toHaveAttribute('multiple');
    });
  });
});
