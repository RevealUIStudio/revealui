import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QUOTE_CALCULATOR } from '../../content/quote-calculator';
import { SITE } from '../../content/site';
import { PricingPage } from '../PricingPage';

afterEach(cleanup);

describe('PricingPage quote calculator', () => {
  it('renders the calculator instead of the leftover storefront', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Pricing' })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.who.options[0].label }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('link', { name: QUOTE_CALCULATOR.introCta.label })).toHaveAttribute(
      'href',
      SITE.urls.bookIntro,
    );
    expect(screen.queryByRole('link', { name: 'Get Started Free' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Buy Pro Perpetual' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Request the RevealUI Starter Kit' })).toBeNull();
  });
});
