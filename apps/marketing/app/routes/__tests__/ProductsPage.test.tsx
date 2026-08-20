import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS_FLAGSHIP, PRODUCTS_SISTERS_SECTION } from '../../content/products';
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

  it('renders lifecycle GA pills and no license-in-status strings', () => {
    renderPage();
    expect(screen.getAllByText('GA').length).toBeGreaterThan(0);
    expect(screen.queryByText('Active (MIT)')).toBeNull();
    expect(screen.queryByText('Beta (MIT)')).toBeNull();
  });

  it('filters sister cards by GA, not Active (MIT)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /GA/ }));
    expect(screen.getByRole('heading', { name: 'RevCon' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RevSkills' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'RevForge' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Active \(MIT\)/ })).toBeNull();
  });

  it('keeps RevForge on Contact and drops white-labeling as a shipped sister capability', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByText(PRODUCTS_SISTERS_SECTION.description)).toBeInTheDocument();
    expect(screen.queryByText(/white-labeling/i)).toBeNull();
  });

  it('styles flagship public CTAs with the presentation Button contract', () => {
    renderPage();
    const docs = screen.getByRole('link', { name: PRODUCTS_FLAGSHIP.ctas.docs.label });
    const pricing = screen.getByRole('link', { name: PRODUCTS_FLAGSHIP.ctas.pricing.label });
    const repo = screen.getByRole('link', { name: PRODUCTS_FLAGSHIP.ctas.repo.label });
    expect(docs.className.includes('h-11')).toBe(true);
    expect(pricing.className.includes('h-11')).toBe(true);
    expect(repo.className.includes('h-11')).toBe(true);
    expect(docs.className.includes('rounded-md bg-primary-foreground')).toBe(false);
  });
});
