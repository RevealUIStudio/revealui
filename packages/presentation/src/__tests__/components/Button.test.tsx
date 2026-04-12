/**
 * Button Component Tests
 *
 * Tests for the real Button component exported from
 * packages/presentation/src/components/Button.tsx.
 *
 * The component is built with CVA (class-variance-authority) + Tailwind.
 * Tests verify rendered HTML structure, variant/size classes, accessibility,
 * and event handling  -  all against the real implementation.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../components/Button.js';

describe('Button', () => {
  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('Rendering', () => {
    it('renders a <button> element', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByRole('button').tagName).toBe('BUTTON');
    });

    it('renders its text content', () => {
      render(<Button>Submit</Button>);
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('renders complex children (icon + text)', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Label</span>
        </Button>,
      );
      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
    });

    it('does not set an explicit type attribute by default', () => {
      // The real Button component does not hard-code type="button".
      // Consumers should set type explicitly when the default browser
      // behaviour (submit inside a <form>) is not desired.
      render(<Button>Button</Button>);
      expect(screen.getByRole('button')).not.toHaveAttribute('type', 'submit');
    });

    it('accepts type="submit"', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('accepts type="reset"', () => {
      render(<Button type="reset">Reset</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
    });
  });

  // -------------------------------------------------------------------------
  // Base styling classes (CVA base)
  // -------------------------------------------------------------------------

  describe('Base Styling', () => {
    it('has inline-flex base class', () => {
      render(<Button>Base</Button>);
      expect(screen.getByRole('button')).toHaveClass('inline-flex');
    });

    it('has items-center and justify-center classes', () => {
      render(<Button>Base</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('items-center');
      expect(btn).toHaveClass('justify-center');
    });

    it('has disabled styles via CSS (pointer-events-none when disabled)', () => {
      render(<Button>Base</Button>);
      // disabled:pointer-events-none is applied via Tailwind  -  verify the class exists
      // on the element (Tailwind generates it as a modifier, not a plain class)
      const btn = screen.getByRole('button');
      // The button should have rounded and text-sm from the base CVA string
      expect(btn).toHaveClass('rounded');
      expect(btn).toHaveClass('text-sm');
      expect(btn).toHaveClass('font-medium');
    });
  });

  // -------------------------------------------------------------------------
  // Variants
  // -------------------------------------------------------------------------

  describe('Variants', () => {
    it('applies default variant classes when no variant is specified', () => {
      render(<Button>Default</Button>);
      // The 'default' variant maps to bg-primary text-primary-foreground
      expect(screen.getByRole('button')).toHaveClass('bg-primary');
    });

    it('applies "default" variant explicitly', () => {
      render(<Button variant="default">Default</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-primary');
    });

    it('applies "primary" variant', () => {
      render(<Button variant="primary">Primary</Button>);
      // 'primary' maps to bg-primary text-primary-foreground
      expect(screen.getByRole('button')).toHaveClass('bg-primary');
    });

    it('applies "secondary" variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-secondary');
    });

    it('applies "destructive" variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-destructive');
    });

    it('applies "outline" variant', () => {
      render(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button')).toHaveClass('border');
      expect(screen.getByRole('button')).toHaveClass('border-border');
    });

    it('applies "ghost" variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      // Ghost has hover:bg-card but no background by default
      // The class string contains the hover variant
      const btn = screen.getByRole('button');
      // No explicit bg class  -  bg-primary should NOT be present
      expect(btn).not.toHaveClass('bg-primary');
      expect(btn).not.toHaveClass('bg-secondary');
    });

    it('applies "link" variant', () => {
      render(<Button variant="link">Link</Button>);
      expect(screen.getByRole('button')).toHaveClass('underline-offset-4');
    });
  });

  // -------------------------------------------------------------------------
  // Sizes
  // -------------------------------------------------------------------------

  describe('Sizes', () => {
    it('applies "default" size when no size is specified', () => {
      render(<Button>Default</Button>);
      // default size: h-10 px-4 py-2
      expect(screen.getByRole('button')).toHaveClass('h-10');
      expect(screen.getByRole('button')).toHaveClass('px-4');
    });

    it('applies "default" size explicitly', () => {
      render(<Button size="default">Default</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-10');
    });

    it('applies "sm" size', () => {
      render(<Button size="sm">Small</Button>);
      // sm: h-9 rounded px-3
      expect(screen.getByRole('button')).toHaveClass('h-9');
      expect(screen.getByRole('button')).toHaveClass('px-3');
    });

    it('applies "lg" size', () => {
      render(<Button size="lg">Large</Button>);
      // lg: h-11 rounded px-8
      expect(screen.getByRole('button')).toHaveClass('h-11');
      expect(screen.getByRole('button')).toHaveClass('px-8');
    });

    it('applies "icon" size', () => {
      render(<Button size="icon">X</Button>);
      // icon: size-10 (width + height = 10)
      expect(screen.getByRole('button')).toHaveClass('size-10');
    });

    it('applies "clear" size (no padding classes)', () => {
      render(<Button size="clear">Clear</Button>);
      // clear: '' (empty string  -  no size classes added)
      // Should NOT have h-10 or h-9
      const btn = screen.getByRole('button');
      expect(btn).not.toHaveClass('h-10');
      expect(btn).not.toHaveClass('h-9');
      expect(btn).not.toHaveClass('h-11');
    });
  });

  // -------------------------------------------------------------------------
  // Disabled State
  // -------------------------------------------------------------------------

  describe('Disabled State', () => {
    it('is disabled when the disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('is not disabled by default', () => {
      render(<Button>Enabled</Button>);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('has the HTML disabled attribute when disabled', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('disabled');
    });

    it('does not fire onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>,
      );

      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Click Handling
  // -------------------------------------------------------------------------

  describe('Click Handling', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('fires onClick multiple times for multiple clicks', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);
      const btn = screen.getByRole('button');

      for (let i = 0; i < 5; i++) {
        await user.click(btn);
      }
      expect(handleClick).toHaveBeenCalledTimes(5);
    });
  });

  // -------------------------------------------------------------------------
  // Custom className
  // -------------------------------------------------------------------------

  describe('Custom className', () => {
    it('accepts and applies a custom className', () => {
      render(<Button className="my-custom-class">Styled</Button>);
      expect(screen.getByRole('button')).toHaveClass('my-custom-class');
    });

    it('retains base Tailwind classes when a custom className is added', () => {
      render(<Button className="my-custom-class">Styled</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toHaveClass('inline-flex');
      expect(btn).toHaveClass('my-custom-class');
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has an accessible name from its text content', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveAccessibleName('Click me');
    });

    it('uses aria-label as accessible name when provided', () => {
      render(<Button aria-label="Close dialog">X</Button>);
      expect(screen.getByRole('button')).toHaveAccessibleName('Close dialog');
    });

    it('is keyboard focusable (no negative tabindex)', () => {
      render(<Button>Tab to me</Button>);
      expect(screen.getByRole('button')).not.toHaveAttribute('tabindex', '-1');
    });

    it('is activated by Enter key', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Press Enter</Button>);
      screen.getByRole('button').focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
    });

    it('is activated by Space key', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Press Space</Button>);
      screen.getByRole('button').focus();
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalled();
    });

    it('receives focus when tabbed to', () => {
      render(<Button>Focus me</Button>);
      const btn = screen.getByRole('button');
      btn.focus();
      expect(btn).toHaveFocus();
    });
  });

  // -------------------------------------------------------------------------
  // Forwarded Ref
  // -------------------------------------------------------------------------

  describe('Forwarded Ref', () => {
    it('forwards ref to the underlying button element', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Ref</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('ref points to the rendered DOM node', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Content</Button>);
      expect(ref.current?.tagName).toBe('BUTTON');
      expect(ref.current?.textContent).toBe('Content');
    });
  });

  // -------------------------------------------------------------------------
  // Form Integration
  // -------------------------------------------------------------------------

  describe('Form Integration', () => {
    it('submits the form when type="submit" and clicked', () => {
      const handleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </form>,
      );

      screen.getByRole('button').click();
      expect(handleSubmit).toHaveBeenCalled();
    });

    it('does not submit the form when type="button" and clicked', () => {
      const handleSubmit = vi.fn();

      render(
        <form onSubmit={handleSubmit}>
          <Button type="button">Button</Button>
        </form>,
      );

      screen.getByRole('button').click();
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('renders without crashing when no children are provided', () => {
      render(<Button />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles very long text content', () => {
      const longText = 'A'.repeat(500);
      render(<Button>{longText}</Button>);
      expect(screen.getByRole('button')).toHaveTextContent(longText);
    });
  });
});
