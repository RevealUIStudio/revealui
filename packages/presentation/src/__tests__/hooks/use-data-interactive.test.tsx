import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useDataInteractive } from '../../hooks/use-data-interactive.js';

function TestButton({ disabled = false }: { disabled?: boolean }) {
  const props = useDataInteractive({ disabled });
  return (
    <button type="button" {...props}>
      Interactive
    </button>
  );
}

describe('useDataInteractive', () => {
  it('should not have any data attributes initially', () => {
    render(<TestButton />);
    const btn = screen.getByRole('button');

    expect(btn).not.toHaveAttribute('data-hover');
    expect(btn).not.toHaveAttribute('data-focus');
    expect(btn).not.toHaveAttribute('data-active');
    expect(btn).not.toHaveAttribute('data-disabled');
  });

  it('should set data-hover on pointer enter and remove on leave', async () => {
    const user = userEvent.setup();
    render(<TestButton />);
    const btn = screen.getByRole('button');

    await user.hover(btn);
    expect(btn).toHaveAttribute('data-hover', '');

    await user.unhover(btn);
    expect(btn).not.toHaveAttribute('data-hover');
  });

  it('should set data-active on pointer down and remove on pointer up', () => {
    render(<TestButton />);
    const btn = screen.getByRole('button');

    fireEvent.pointerDown(btn);
    expect(btn).toHaveAttribute('data-active', '');

    fireEvent.pointerUp(btn);
    expect(btn).not.toHaveAttribute('data-active');
  });

  it('should set data-disabled when disabled', () => {
    render(<TestButton disabled />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-disabled', '');
  });

  it('should not set data-hover when disabled', async () => {
    const user = userEvent.setup();
    render(<TestButton disabled />);
    const btn = screen.getByRole('button');

    await user.hover(btn);
    expect(btn).not.toHaveAttribute('data-hover');
  });

  it('should not set data-active when disabled', () => {
    render(<TestButton disabled />);
    const btn = screen.getByRole('button');

    fireEvent.pointerDown(btn);
    expect(btn).not.toHaveAttribute('data-active');
  });

  it('should remove data-active on pointer leave', () => {
    render(<TestButton />);
    const btn = screen.getByRole('button');

    fireEvent.pointerDown(btn);
    expect(btn).toHaveAttribute('data-active', '');

    fireEvent.pointerLeave(btn);
    expect(btn).not.toHaveAttribute('data-active');
  });
});
