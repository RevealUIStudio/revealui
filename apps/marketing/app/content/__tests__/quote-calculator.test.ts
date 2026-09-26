import { describe, expect, it } from 'vitest';
import {
  PERPETUAL_PRICE_FALLBACKS,
  SUBSCRIPTION_PRICE_FALLBACKS,
} from '../../lib/pricing-fallbacks';
import {
  DEFAULT_QUOTE_ANSWERS,
  QUOTE_CALCULATOR,
  type QuoteAnswers,
  resolveQuote,
} from '../quote-calculator';
import { SITE } from '../site';

const BOOKING_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ21UZVcuYp7yO32rZmhyUvZFDJcvles81E9edGNFwSUP8SHEVzGvq0gKgNFo7q04YS5i-12ZE5P';

const STUDIO_PRICES = ['$300', '$3,997', '$7,500', '$14,500', '$1,500'] as const;

describe('quote calculator (product-site lockstep)', () => {
  it('defaults Who to I will (self-host) on this site', () => {
    expect(DEFAULT_QUOTE_ANSWERS.who).toBe('self');
    expect(DEFAULT_QUOTE_ANSWERS.places).toBe('one');
    expect(QUOTE_CALCULATOR.questions.who.options[0]?.id).toBe('self');
  });

  it('asks who runs it and how many sites, with Studio as an outbound path', () => {
    expect(QUOTE_CALCULATOR.heading).toBe('Who runs it. What you need. One product price.');
    expect(QUOTE_CALCULATOR.bodies.home).toBe(
      'Need implementation? Studio is a separate path (Consultation, Pilot, Launch). This catalog is licenses only.',
    );
    expect(QUOTE_CALCULATOR.bodies.pricing).toBe(QUOTE_CALCULATOR.bodies.home);
    expect(QUOTE_CALCULATOR.questions.who.label).toBe('Who runs it?');
    expect(QUOTE_CALCULATOR.questions.places.label).toBe('How many sites?');
    expect(QUOTE_CALCULATOR.questions.who.options.map((option) => option.id)).toEqual([
      'self',
      'studio',
    ]);
    expect(QUOTE_CALCULATOR.questions.who.options.map((option) => option.label)).toEqual([
      'I self-host the runtime',
      'I need Studio implementation',
    ]);
    expect(QUOTE_CALCULATOR.questions.places.options.map((option) => option.id)).toEqual([
      'one',
      'many',
    ]);
    expect(QUOTE_CALCULATOR.questions.places.options[0]?.label).toBe('One business, one site');
    expect(QUOTE_CALCULATOR.questions.places.options[1]?.label).toBe(
      'More than one: book an intro',
    );
    expect(QUOTE_CALCULATOR.selfHost.title).toBe('Self-host licenses');
    expect(QUOTE_CALCULATOR.studioPath.label).toBe('Studio path');
    expect(QUOTE_CALCULATOR.studioPath.title).toBe('RevealUI Studio');
    expect(QUOTE_CALCULATOR.studioPath.body).toBe(
      'Open the separate RevealUI Studio quote. Studio lists Consultation, Pilot, and Launch on its own domain.',
    );
    expect(QUOTE_CALCULATOR.studioCta.label).toBe('Visit Studio quote');
    expect(QUOTE_CALCULATOR.studioCta.href).toBe(`${SITE.urls.agency}/#calculator`);
    expect(QUOTE_CALCULATOR.intro.title).toBe('More than one site');
    expect(QUOTE_CALCULATOR.intro.body).toBe(
      'The calculator stops here. Book a 30-minute intro to scope it.',
    );
    expect(QUOTE_CALCULATOR.introCta.note).toBe('Google Calendar / Google Meet.');
  });

  it('locksteps printed product license numbers and omits Studio SKU prices', () => {
    expect(QUOTE_CALCULATOR.selfHost.free).toContain(SUBSCRIPTION_PRICE_FALLBACKS.free.price);
    expect(QUOTE_CALCULATOR.selfHost.agents).toContain(SUBSCRIPTION_PRICE_FALLBACKS.pro.price);
    expect(QUOTE_CALCULATOR.selfHost.agents).toContain(SUBSCRIPTION_PRICE_FALLBACKS.max.price);
    const perpetual = PERPETUAL_PRICE_FALLBACKS['Pro Perpetual'];
    expect(perpetual).toBeDefined();
    expect(QUOTE_CALCULATOR.selfHost.perpetual).toContain(perpetual?.price);
    expect(QUOTE_CALCULATOR.selfHost.agents).toContain('$49');
    expect(QUOTE_CALCULATOR.selfHost.agents).toContain('$99');
    expect(QUOTE_CALCULATOR.selfHost.perpetual).toContain('$1,499');
    const blob = JSON.stringify(QUOTE_CALCULATOR);
    for (const price of STUDIO_PRICES) {
      expect(blob.includes(price)).toBe(false);
    }
  });

  it('prints the self-host quote when Who is I will', () => {
    const quote = resolveQuote({ who: 'self', places: 'one' });
    expect(quote.kind).toBe('self-host');
    expect(quote.title).toBe('Self-host licenses');
    expect(quote.studioCta).toBeUndefined();
    expect(quote.lines).toEqual([
      QUOTE_CALCULATOR.selfHost.free,
      QUOTE_CALCULATOR.selfHost.agents,
      QUOTE_CALCULATOR.selfHost.perpetual,
      QUOTE_CALCULATOR.selfHost.enterprise,
    ]);
    expect(quote.startFreeCta?.href).toBe(SITE.urls.signup);
    expect(quote.lines.join('\n').includes('14-day')).toBe(false);
  });

  it('routes Studio implementation to revealuistudio.com without Studio prices', () => {
    const quote = resolveQuote({ who: 'studio', places: 'one' });
    const many = resolveQuote({ who: 'studio', places: 'many' });
    expect(quote.kind).toBe('studio');
    expect(many.kind).toBe('studio');
    expect(quote.pathLabel).toBe('Studio path');
    expect(quote.title).toBe('RevealUI Studio');
    expect(quote.lines).toEqual([QUOTE_CALCULATOR.studioPath.body]);
    expect(quote.studioCta).toEqual({
      label: 'Visit Studio quote',
      href: 'https://revealuistudio.com/#calculator',
    });
    expect(quote.startFreeCta).toBeUndefined();
    const lines = quote.lines.join('\n');
    for (const price of STUDIO_PRICES) {
      expect(lines.includes(price)).toBe(false);
    }
    expect(lines.includes('Pilot')).toBe(true);
    expect(lines.includes('Proof Sprint')).toBe(false);
    expect(lines.includes('Stage B')).toBe(false);
    expect(lines.includes('waive')).toBe(false);
    expect(lines.includes('Pilot $1,500')).toBe(false);
    expect(lines.includes('Zapier')).toBe(false);
  });

  it('stops quoting and books an intro when there is more than one place', () => {
    const selfMany = resolveQuote({ who: 'self', places: 'many' });
    expect(selfMany.kind).toBe('intro');
    expect(selfMany.title).toBe(QUOTE_CALCULATOR.intro.title);
    expect(selfMany.lines).toContain(QUOTE_CALCULATOR.intro.body);
    expect(selfMany.studioCta).toBeUndefined();
  });

  it('always carries ownership lines and the Google Calendar intro', () => {
    const answers: QuoteAnswers[] = [
      { who: 'self', places: 'one' },
      { who: 'studio', places: 'one' },
      { who: 'self', places: 'many' },
    ];
    for (const answer of answers) {
      const quote = resolveQuote(answer);
      expect(quote.ownership).toEqual([...QUOTE_CALCULATOR.ownership]);
      expect(quote.introCta.href).toBe(BOOKING_URL);
      expect(quote.introCta.href).toBe(SITE.urls.bookIntro);
      expect(quote.introCta.href.startsWith('https://calendar.google.com/')).toBe(true);
      expect(quote.introCta.note).toBe('Google Calendar / Google Meet.');
    }
  });

  it('does not put fleet math, leftover kit prices, or holdback four-tests in the calculator copy', () => {
    const blob = JSON.stringify(QUOTE_CALCULATOR);
    expect(blob.includes('$25,000')).toBe(false);
    expect(blob.includes('$50,000')).toBe(false);
    expect(blob.includes('$8,499')).toBe(false);
    expect(blob.includes('$99')).toBe(true);
    expect(blob.includes('Starter Kit')).toBe(false);
    expect(blob.includes('Agency Founding Kit')).toBe(false);
    expect(blob.includes('Agency Perpetual')).toBe(false);
    expect(blob.includes('https://calendar.google.com/')).toBe(true);
    expect(blob.includes('Fleet from')).toBe(false);
    expect(blob.includes('Custom from')).toBe(false);
    expect(blob.includes('written plan')).toBe(false);
    expect(blob.includes('Written plan')).toBe(false);
    expect(blob.includes('Hour')).toBe(false);
    expect(blob.includes('four tests')).toBe(false);
    expect(blob.includes('keep the stack')).toBe(false);
    expect(blob.includes('first half')).toBe(false);
    expect(blob.includes('RevealFleet')).toBe(false);
    expect(blob.includes('RevForge')).toBe(false);
    expect(blob.includes('RevKit')).toBe(false);
    expect(blob.includes('Maryville')).toBe(false);
    expect(blob.includes('cal.com')).toBe(false);
    expect(blob.includes('14-day')).toBe(false);
    expect(blob.includes('sit down')).toBe(false);
    expect(blob.includes('Three questions. A price you can read.')).toBe(false);
    expect(blob.includes('proof of work')).toBe(false);
    expect(blob.includes('Stage B')).toBe(false);
    expect(blob.includes('waive')).toBe(false);
    expect(blob.includes('Pilot')).toBe(true);
    expect(blob.includes('Proof Sprint')).toBe(false);
    expect(blob.includes('Pilot $1,500')).toBe(false);
    expect(blob.includes('Zapier')).toBe(false);
    expect(blob.includes('\u2014')).toBe(false);
    expect(blob.includes(' / Meet.')).toBe(false);
  });
});
