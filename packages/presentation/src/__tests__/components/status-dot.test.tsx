import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusDot } from '../../components/status-dot.js';

/**
 * Drives the `prefers-reduced-motion` media query. jsdom has no matchMedia, so
 * the `useReducedMotion` primitive reads whatever we install here.
 */
function setReducedMotion(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StatusDot', () => {
  it('exposes the required label to assistive tech', () => {
    setReducedMotion(false);
    render(<StatusDot status="ok" label="API: healthy" />);
    expect(screen.getByRole('img', { name: 'API: healthy' })).toBeInTheDocument();
  });

  it('maps each status to its --rvui-* token fill (no raw palette)', () => {
    setReducedMotion(false);
    const cases: Array<[Parameters<typeof StatusDot>[0]['status'], string]> = [
      ['ok', 'bg-[var(--rvui-success)]'],
      ['warn', 'bg-[var(--rvui-warning)]'],
      ['error', 'bg-[var(--rvui-error)]'],
      ['idle', 'bg-[var(--rvui-text-2)]'],
    ];
    for (const [status, token] of cases) {
      const { container, unmount } = render(<StatusDot status={status} label={status} />);
      const dot = container.querySelector('span > span[aria-hidden="true"]');
      expect(dot?.className).toContain(token);
      unmount();
    }
  });

  it('renders the pulse ring when pulse is set and motion is allowed', () => {
    setReducedMotion(false);
    const { container } = render(<StatusDot status="ok" label="live" pulse />);
    expect(container.querySelector('.animate-ping')).not.toBeNull();
  });

  it('suppresses the pulse ring when reduced motion is requested', () => {
    setReducedMotion(true);
    const { container } = render(<StatusDot status="ok" label="live" pulse />);
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('never renders a pulse ring without the pulse prop', () => {
    setReducedMotion(false);
    const { container } = render(<StatusDot status="warn" label="degraded" />);
    expect(container.querySelector('.animate-ping')).toBeNull();
  });
});
