import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RootLayout } from '../RootLayout';

afterEach(cleanup);

describe('RootLayout skip link', () => {
  it('renders Skip to content above the sticky header stacking level', () => {
    render(
      <RouterProvider router={new Router()}>
        <RootLayout>
          <p>Page</p>
        </RootLayout>
      </RouterProvider>,
    );

    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip.className).toContain('focus:z-[60]');
    const header = screen.getByRole('banner');
    expect(header.className).toContain('z-50');
  });
});
