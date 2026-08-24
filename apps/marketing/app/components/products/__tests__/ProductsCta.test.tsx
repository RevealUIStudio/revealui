import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PRODUCTS_CTA_SECTION } from '../../../content/products';
import { ProductsCta } from '../ProductsCta';

afterEach(cleanup);

describe('ProductsCta', () => {
  it('renders docs and pricing as presentation Button children, not homemade primary anchors', () => {
    render(<ProductsCta />);
    const docs = screen.getByRole('link', { name: PRODUCTS_CTA_SECTION.cta.docs.label });
    const pricing = screen.getByRole('link', { name: PRODUCTS_CTA_SECTION.cta.pricing.label });
    expect(docs.className.includes('h-12')).toBe(true);
    expect(pricing.className.includes('h-12')).toBe(true);
    expect(docs.className.includes('rounded-md bg-primary')).toBe(false);
    expect(pricing.className.includes('rounded-md bg-secondary')).toBe(false);
  });

  it('keeps the inverted CLI snippet box', () => {
    render(<ProductsCta />);
    expect(screen.getByText(PRODUCTS_CTA_SECTION.cliSnippet)).toBeInTheDocument();
  });
});
