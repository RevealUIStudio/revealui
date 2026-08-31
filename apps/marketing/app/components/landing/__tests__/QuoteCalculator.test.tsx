import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QUOTE_CALCULATOR } from '../../../content/quote-calculator';
import { SITE } from '../../../content/site';
import { QuoteCalculator } from '../QuoteCalculator';

afterEach(cleanup);

describe('QuoteCalculator', () => {
  it('defaults Who to I will', () => {
    render(<QuoteCalculator />);
    const self = screen.getByRole('radio', {
      name: QUOTE_CALCULATOR.questions.who.options[0].label,
    });
    expect(self).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.title)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.free)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.agents)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: QUOTE_CALCULATOR.startFreeCta.label })).toHaveAttribute(
      'href',
      SITE.urls.signup,
    );
  });

  it('prints Free, Pro, and Max on the self-host default without talking', () => {
    render(<QuoteCalculator />);
    const card = screen.getByTestId('quote-card');
    expect(card.textContent ?? '').toContain('Free');
    expect(card.textContent ?? '').toContain('$49');
    expect(card.textContent ?? '').toContain('$99');
    expect(card.textContent ?? '').not.toContain('$300');
    expect(card.textContent ?? '').not.toContain('$1,500');
    expect(card.textContent ?? '').not.toContain('$7,500');
  });

  it('prints the Studio SKU trio when You will and one place', () => {
    render(<QuoteCalculator />);
    fireEvent.click(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.who.options[1].label }),
    );
    const card = screen.getByTestId('quote-card');
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.consultation.title)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.consultation.price)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.pilot.title)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.pilot.price)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.launch.title)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.launch.price)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.consultation.body)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studio.pilot.body)).toBeInTheDocument();
    expect(
      within(card).getByText(QUOTE_CALCULATOR.studio.launch.body, { exact: true }),
    ).toBeInTheDocument();
  });

  it('stops quoting when there is more than one place', () => {
    render(<QuoteCalculator />);
    fireEvent.click(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.places.options[1].label }),
    );
    expect(screen.getByText(QUOTE_CALCULATOR.intro.title)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.intro.body)).toBeInTheDocument();
  });

  it('always shows ownership lines and the Google Calendar intro', () => {
    render(<QuoteCalculator />);
    expect(screen.getByText(QUOTE_CALCULATOR.ownership[0])).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.ownership[1])).toBeInTheDocument();
    const intro = screen.getByRole('link', { name: QUOTE_CALCULATOR.introCta.label });
    expect(intro).toHaveAttribute('href', SITE.urls.bookIntro);
    expect(intro.getAttribute('href') ?? '').toContain('https://calendar.google.com/');
  });

  it('does not render leftover Fleet, Custom, or kit prices', () => {
    const { container } = render(<QuoteCalculator />);
    const text = container.textContent ?? '';
    expect(text.includes('$25,000')).toBe(false);
    expect(text.includes('$50,000')).toBe(false);
    expect(text.includes('$8,499')).toBe(false);
    expect(text.includes('Starter Kit')).toBe(false);
    expect(text.includes('written plan')).toBe(false);
    expect(text.includes('four tests')).toBe(false);
    expect(text.includes('https://calendar.google.com/')).toBe(false);
  });
});
