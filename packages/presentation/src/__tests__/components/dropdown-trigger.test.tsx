/**
 * DropdownTriggerButton + TouchTarget tests
 *
 * Covers the internal trigger primitive that `Dropdown` composes (renders a
 * button or an anchor, keeps the `type="button"` default, blocks click when
 * disabled) and the shared `TouchTarget` hit-area primitive.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TouchTarget } from '../../components/_button-shared.js';
import { DropdownTriggerButton } from '../../components/dropdown-trigger.js';

describe('DropdownTriggerButton', () => {
  it('renders a button element by default', () => {
    render(<DropdownTriggerButton>Actions</DropdownTriggerButton>);

    const button = screen.getByRole('button', { name: /actions/i });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('renders children content', () => {
    render(<DropdownTriggerButton>Menu</DropdownTriggerButton>);
    expect(screen.getByText('Menu')).toBeInTheDocument();
  });

  it('has type="button" by default', () => {
    render(<DropdownTriggerButton>Default</DropdownTriggerButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('renders as an anchor when href is provided', () => {
    render(<DropdownTriggerButton href="/dashboard">Go</DropdownTriggerButton>);

    const link = screen.getByRole('link', { name: /go/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('applies the disabled state and blocks click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownTriggerButton disabled onClick={onClick}>
        Disabled
      </DropdownTriggerButton>,
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('accepts type="submit"', () => {
    render(<DropdownTriggerButton type="submit">Submit</DropdownTriggerButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('applies a custom className', () => {
    render(<DropdownTriggerButton className="my-custom-class">Styled</DropdownTriggerButton>);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });

  it('styles the focus ring from the shared --ring token, not a fixed palette', () => {
    render(<DropdownTriggerButton>Focus</DropdownTriggerButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('data-focus:outline-ring');
    expect(button.className).not.toContain('outline-blue-500');
  });
});

describe('TouchTarget', () => {
  it('renders children', () => {
    render(<TouchTarget>Touch content</TouchTarget>);
    expect(screen.getByText('Touch content')).toBeInTheDocument();
  });

  it('renders a hidden touch hit area span', () => {
    const { container } = render(<TouchTarget>Content</TouchTarget>);
    const hitArea = container.querySelector('span[aria-hidden="true"]');
    expect(hitArea).toBeInTheDocument();
  });
});
