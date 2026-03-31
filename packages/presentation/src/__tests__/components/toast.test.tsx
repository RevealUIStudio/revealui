import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../components/toast.js';

// Helper component that exposes the toast API via test IDs
function ToastTrigger({
  title,
  variant,
  duration,
}: {
  title: string;
  variant?: string;
  duration?: number;
}) {
  const { addToast, removeToast } = useToast();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const id = addToast({ title, variant: variant as never, duration });
          (window as never).__lastToastId = id;
        }}
      >
        Show toast
      </button>
      <button
        type="button"
        onClick={() => {
          removeToast((window as never).__lastToastId);
        }}
      >
        Remove toast
      </button>
    </>
  );
}

describe('Toast', () => {
  it('renders a toast when addToast is called', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger title="Hello toast" duration={0} />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByText('Show toast').click();
    });
    expect(screen.getByText('Hello toast')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('removes a toast when removeToast is called', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger title="Removable toast" duration={0} />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByText('Show toast').click();
    });
    expect(screen.getByText('Removable toast')).toBeInTheDocument();
    await act(async () => {
      screen.getByText('Remove toast').click();
    });
    expect(screen.queryByText('Removable toast')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('auto-dismisses after duration', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger title="Auto-dismiss" duration={1000} />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByText('Show toast').click();
    });
    expect(screen.getByText('Auto-dismiss')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText('Auto-dismiss')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does not auto-dismiss when duration is 0', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger title="Persistent toast" duration={0} />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByText('Show toast').click();
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Persistent toast')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders a close button on the toast', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger title="Closeable" duration={0} />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByText('Show toast').click();
    });
    expect(screen.getByText('Closeable')).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    await act(async () => {
      closeBtn.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Closeable')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
