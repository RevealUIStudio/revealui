import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS_FLAGSHIP } from '../../content/products';
import { ProductsPage } from '../ProductsPage';

vi.mock('../../lib/api', () => ({ fetchPageBlocks: vi.fn().mockResolvedValue(null) }));

function renderPage() {
  return render(
    <RouterProvider router={new Router()}>
      <ProductsPage />
    </RouterProvider>,
  );
}

afterEach(cleanup);

describe('ProductsPage honesty and presentation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }),
    );
  });

  it('presents RevealUI licenses, not a RevFleet sister roster', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: 'The RevFleet product family' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'RevCon' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'RevSkills' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'RevForge' })).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Filter products by status' })).toBeNull();
    expect(screen.queryByText('Active (MIT)')).toBeNull();
    expect(screen.queryByText('Beta (MIT)')).toBeNull();
    expect(screen.getByRole('heading', { name: 'RevealUI' })).toBeInTheDocument();
  });

  it('styles flagship public CTAs with the presentation Button contract', () => {
    renderPage();
    const docs = screen.getByRole('link', { name: PRODUCTS_FLAGSHIP.ctas.docs.label });
    const pricing = screen.getByRole('link', { name: PRODUCTS_FLAGSHIP.ctas.pricing.label });
    const flagshipRepo = screen
      .getAllByRole('link', { name: PRODUCTS_FLAGSHIP.ctas.repo.label })
      .find((link) => link.getAttribute('href') === PRODUCTS_FLAGSHIP.ctas.repo.href);
    expect(docs.className.includes('h-11')).toBe(true);
    expect(pricing.className.includes('h-11')).toBe(true);
    expect(flagshipRepo).toBeDefined();
    expect(flagshipRepo?.className.includes('h-11')).toBe(true);
    expect(docs.className.includes('rounded-md bg-primary-foreground')).toBe(false);
  });
});
