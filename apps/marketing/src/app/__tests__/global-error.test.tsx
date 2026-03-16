/**
 * GlobalError Component Tests
 *
 * Tests the global error boundary component that handles
 * unrecoverable errors in the Next.js application.
 */

import { describe, expect, it, vi } from 'vitest';
import GlobalError from '../global-error';

describe('GlobalError', () => {
  it('exports a default function component', () => {
    expect(typeof GlobalError).toBe('function');
  });

  it('returns an html element with lang="en"', () => {
    const error = new Error('test error') as Error & { digest?: string };
    const reset = vi.fn();
    const result = GlobalError({ error, reset });

    expect(result.type).toBe('html');
    expect(result.props.lang).toBe('en');
  });

  it('renders error message text', () => {
    const error = new Error('test error') as Error & { digest?: string };
    const reset = vi.fn();
    const result = GlobalError({ error, reset });
    const html = JSON.stringify(result);

    expect(html).toContain('Something went wrong!');
    expect(html).toContain('We apologize for the inconvenience');
  });

  it('renders a "Try again" button', () => {
    const error = new Error('test error') as Error & { digest?: string };
    const reset = vi.fn();
    const result = GlobalError({ error, reset });
    const html = JSON.stringify(result);

    expect(html).toContain('Try again');
  });

  it('displays error digest when present', () => {
    const error = Object.assign(new Error('test'), { digest: 'abc123' });
    const reset = vi.fn();
    const result = GlobalError({ error, reset });
    const html = JSON.stringify(result);

    expect(html).toContain('Error ID:');
    expect(html).toContain('abc123');
  });

  it('does not display error digest when absent', () => {
    const error = new Error('test') as Error & { digest?: string };
    const reset = vi.fn();
    const result = GlobalError({ error, reset });
    const html = JSON.stringify(result);

    expect(html).not.toContain('Error ID:');
  });

  it('exports dynamic as force-dynamic', async () => {
    const mod = await import('../global-error');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
