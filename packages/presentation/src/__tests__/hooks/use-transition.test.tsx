import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransition } from '../../hooks/use-transition.js';

function TransitionComponent({ show }: { show: boolean }) {
  const { mounted, nodeRef, transitionProps } = useTransition(show);

  if (!mounted) return <span data-testid="unmounted">hidden</span>;

  return (
    <div
      ref={nodeRef}
      data-testid="transition-el"
      data-closed={transitionProps['data-closed']}
      data-enter={transitionProps['data-enter']}
      data-leave={transitionProps['data-leave']}
      data-transition={transitionProps['data-transition']}
    >
      content
    </div>
  );
}

describe('useTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render content when show is true', () => {
    render(<TransitionComponent show={true} />);
    expect(screen.getByTestId('transition-el')).toBeInTheDocument();
  });

  it('should not render content when show is false', () => {
    render(<TransitionComponent show={false} />);
    expect(screen.getByTestId('unmounted')).toBeInTheDocument();
  });

  it('should mount with enter-from state when show changes to true', () => {
    const { rerender } = render(<TransitionComponent show={false} />);
    expect(screen.getByTestId('unmounted')).toBeInTheDocument();

    rerender(<TransitionComponent show={true} />);

    const el = screen.getByTestId('transition-el');
    expect(el).toHaveAttribute('data-closed');
    expect(el).toHaveAttribute('data-enter');
    expect(el).toHaveAttribute('data-transition');
  });

  it('should transition to enter-to after animation frames', async () => {
    const { rerender } = render(<TransitionComponent show={false} />);

    rerender(<TransitionComponent show={true} />);

    // Advance past the two rAF calls
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const el = screen.getByTestId('transition-el');
    // data-closed should be removed, data-enter still present
    expect(el).not.toHaveAttribute('data-closed');
    expect(el).toHaveAttribute('data-enter');
  });

  it('should complete enter after fallback timeout', async () => {
    const { rerender } = render(<TransitionComponent show={false} />);

    rerender(<TransitionComponent show={true} />);

    // Advance past rAF + 500ms fallback
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const el = screen.getByTestId('transition-el');
    expect(el).not.toHaveAttribute('data-closed');
    expect(el).not.toHaveAttribute('data-enter');
    expect(el).not.toHaveAttribute('data-leave');
    expect(el).not.toHaveAttribute('data-transition');
  });

  it('should start leave transition when show changes to false', async () => {
    const { rerender } = render(<TransitionComponent show={true} />);

    rerender(<TransitionComponent show={false} />);

    // The element should still be mounted in leave state
    const el = screen.getByTestId('transition-el');
    expect(el).toHaveAttribute('data-closed');
    expect(el).toHaveAttribute('data-leave');
    expect(el).toHaveAttribute('data-transition');
  });

  it('should unmount after leave transition completes', async () => {
    const { rerender } = render(<TransitionComponent show={true} />);

    rerender(<TransitionComponent show={false} />);

    // Wait for fallback timeout
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId('unmounted')).toBeInTheDocument();
  });
});
