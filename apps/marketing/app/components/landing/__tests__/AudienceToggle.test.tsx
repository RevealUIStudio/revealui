import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AudienceToggle } from '../AudienceToggle';

afterEach(cleanup);

function renderToggle(current: 'non-technical' | 'technical' = 'non-technical') {
  return render(
    <RouterProvider router={new Router()}>
      <AudienceToggle current={current} />
    </RouterProvider>,
  );
}

describe('AudienceToggle', () => {
  it('keeps the nav landmark and styles the active pill as a presentation Button', () => {
    renderToggle('non-technical');
    expect(screen.getByRole('navigation', { name: 'Choose your view' })).toBeInTheDocument();
    const active = screen.getByRole('link', { name: 'Non-technical' });
    expect(active).toHaveAttribute('aria-current', 'true');
    expect(active.className.includes('h-10')).toBe(true);
    expect(active.className.includes('bg-primary')).toBe(true);
  });
});
