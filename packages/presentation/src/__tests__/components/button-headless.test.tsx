/**
 * Button Headless Component Tests
 *
 * Tests the headless Button and TouchTarget components for rendering,
 * variants, disabled state, and link behavior.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, TouchTarget } from '../../components/button-headless.js';

describe('Button', () => {
  it('should render a button element by default', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should render children content', () => {
    render(<Button>Save changes</Button>);

    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('should have type="button" by default', () => {
    render(<Button>Default</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('should render as a link when href is provided', () => {
    render(<Button href="/dashboard">Go to dashboard</Button>);

    const link = screen.getByRole('link', { name: /go to dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('should apply disabled state with opacity', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not fire click when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );

    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should apply outline variant styles', () => {
    render(<Button outline>Outline</Button>);

    const button = screen.getByRole('button');
    expect(button.className).toContain('border-zinc-950/10');
  });

  it('should apply plain variant styles', () => {
    render(<Button plain>Plain</Button>);

    const button = screen.getByRole('button');
    expect(button.className).toContain('border-transparent');
  });

  it('should accept type="submit"', () => {
    render(<Button type="submit">Submit</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('should apply custom className', () => {
    render(<Button className="my-custom-class">Styled</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('my-custom-class');
  });
});

describe('TouchTarget', () => {
  it('should render children', () => {
    render(<TouchTarget>Touch content</TouchTarget>);

    expect(screen.getByText('Touch content')).toBeInTheDocument();
  });

  it('should render a hidden touch hit area span', () => {
    const { container } = render(<TouchTarget>Content</TouchTarget>);

    const hitArea = container.querySelector('span[aria-hidden="true"]');
    expect(hitArea).toBeInTheDocument();
  });
});
