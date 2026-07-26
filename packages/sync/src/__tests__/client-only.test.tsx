import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClientOnly } from '../client-only.js';
import { ElectricProvider, useElectricConfig } from '../provider/index.js';

describe('ClientOnly', () => {
  it('renders children after client mount', () => {
    render(
      <ClientOnly>
        <div data-testid="gated">gated content</div>
      </ClientOnly>,
    );

    expect(screen.getByTestId('gated')).toBeInTheDocument();
  });

  it('renders nothing during server prerender', () => {
    expect(
      renderToString(
        <ClientOnly>
          <div>gated content</div>
        </ClientOnly>,
      ),
    ).toBe('');
  });

  it('shields the server prerender from children that require a browser, like shape hooks', () => {
    // Regression stand-in for Sentry REVEALUI-ADMIN-8: shape hooks throw
    // TypeError: Invalid URL when constructed without a browser origin.
    function BrowserOnlyChild(): ReactNode {
      throw new TypeError('Invalid URL');
    }

    expect(() =>
      renderToString(
        <ClientOnly>
          <BrowserOnlyChild />
        </ClientOnly>,
      ),
    ).not.toThrow();
  });
});

describe('ElectricProvider proxyBaseUrl default', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ElectricProvider>{children}</ElectricProvider>
  );

  it('defaults to window.location.origin in the browser', () => {
    const { result } = renderHook(() => useElectricConfig(), { wrapper });

    expect(result.current.proxyBaseUrl).toBe(window.location.origin);
    expect(result.current.proxyBaseUrl).not.toBe('');
  });

  it('honors an explicit proxyBaseUrl prop over the origin default', () => {
    const explicit = ({ children }: { children: ReactNode }) => (
      <ElectricProvider proxyBaseUrl="https://admin.example.com">{children}</ElectricProvider>
    );
    const { result } = renderHook(() => useElectricConfig(), { wrapper: explicit });

    expect(result.current.proxyBaseUrl).toBe('https://admin.example.com');
  });
});
