import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QUOTE_CALCULATOR } from '../../../content/quote-calculator';
import { SITE } from '../../../content/site';
import { QuoteCalculator } from '../QuoteCalculator';

afterEach(cleanup);

const STUDIO_PRICES = ['$300', '$1,500', '$3,997', '$7,500', '$14,500'] as const;

function expectNoStudioPrices(text: string): void {
  for (const price of STUDIO_PRICES) {
    expect(text.includes(price)).toBe(false);
  }
  expect(text.includes('Stage B')).toBe(false);
  expect(text.includes('waive')).toBe(false);
  expect(text.includes('Pilot')).toBe(false);
  expect(text.includes('proof of work')).toBe(false);
  expect(text.includes('\u2014')).toBe(false);
  expect(text.includes(' / Meet.')).toBe(false);
}

describe('QuoteCalculator', () => {
  it('defaults Who to I will', () => {
    render(<QuoteCalculator surface="home" />);
    const self = screen.getByRole('radio', {
      name: QUOTE_CALCULATOR.questions.who.options[0].label,
    });
    expect(self).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: /Proof Sprint/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Consultation/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Launch/i })).toBeNull();
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.title)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.free)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.agents)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: QUOTE_CALCULATOR.startFreeCta.label })).toHaveAttribute(
      'href',
      SITE.urls.signup,
    );
    expect(screen.getByText(QUOTE_CALCULATOR.bodies.home)).toBeInTheDocument();
  });

  it('prints Free, Pro, and Max on the self-host default without talking', () => {
    render(<QuoteCalculator surface="home" />);
    const card = screen.getByTestId('quote-card');
    expect(card.textContent ?? '').toContain('Free');
    expect(card.textContent ?? '').toContain('$49');
    expect(card.textContent ?? '').toContain('$99');
    expect(card.textContent ?? '').toContain('$1,499');
    expectNoStudioPrices(card.textContent ?? '');
  });

  it('shows the home Studio boundary as an outbound quote link', () => {
    render(<QuoteCalculator surface="home" />);
    expect(screen.getByText(QUOTE_CALCULATOR.bodies.home)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.who.options[1].label }),
    );
    const card = screen.getByTestId('quote-card');
    expect(within(card).getByText(QUOTE_CALCULATOR.studioPath.label)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studioPath.title)).toBeInTheDocument();
    expect(within(card).getByText(QUOTE_CALCULATOR.studioPath.body)).toBeInTheDocument();
    const studio = within(card).getByRole('link', { name: QUOTE_CALCULATOR.studioCta.label });
    expect(studio).toHaveAttribute('href', `${SITE.urls.agency}/#calculator`);
    expect(studio).toHaveAttribute('target', '_blank');
    expect(studio).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: QUOTE_CALCULATOR.startFreeCta.label })).toBeNull();
    expect(screen.queryByText('Choose, pay, prep, meet, keep the pack.')).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'How many sites?' })).toBeNull();
    expectNoStudioPrices(card.textContent ?? '');
  });

  it('shows the pricing Studio boundary as an outbound quote link', () => {
    render(<QuoteCalculator surface="pricing" />);
    expect(screen.getByText(QUOTE_CALCULATOR.bodies.pricing)).toBeInTheDocument();
    expect(screen.queryByText(QUOTE_CALCULATOR.bodies.home)).toBeNull();
    fireEvent.click(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.who.options[1].label }),
    );
    const card = screen.getByTestId('quote-card');
    expect(within(card).getByText('Studio path')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Visit Studio quote' })).toHaveAttribute(
      'href',
      'https://revealuistudio.com/#calculator',
    );
    expectNoStudioPrices(card.textContent ?? '');
  });

  it('stops quoting when there is more than one place', () => {
    render(<QuoteCalculator surface="home" />);
    fireEvent.click(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.places.options[1].label }),
    );
    expect(screen.getByText(QUOTE_CALCULATOR.intro.title)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.intro.body)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Visit Studio quote' })).toBeNull();
  });

  it('always shows ownership lines and the Google Calendar intro', () => {
    render(<QuoteCalculator surface="pricing" />);
    expect(screen.getByText(QUOTE_CALCULATOR.ownership[0])).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.ownership[1])).toBeInTheDocument();
    const intro = screen.getByRole('link', { name: QUOTE_CALCULATOR.introCta.label });
    expect(intro).toHaveAttribute('href', SITE.urls.bookIntro);
    expect(intro.getAttribute('href') ?? '').toContain('https://calendar.google.com/');
    expect(screen.getByText('Google Calendar / Google Meet.')).toBeInTheDocument();
  });

  it('does not render leftover Fleet, Custom, or kit prices', () => {
    const { container } = render(<QuoteCalculator surface="home" />);
    const text = container.textContent ?? '';
    expect(text.includes('$25,000')).toBe(false);
    expect(text.includes('$50,000')).toBe(false);
    expect(text.includes('$8,499')).toBe(false);
    expect(text.includes('Starter Kit')).toBe(false);
    expect(text.includes('written plan')).toBe(false);
    expect(text.includes('four tests')).toBe(false);
    expect(text.includes('https://calendar.google.com/')).toBe(false);
    expectNoStudioPrices(text);
  });
});
