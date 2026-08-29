import {
  ARCHITECTURE_REVIEW_PRICE,
  CONSULTING_HOUR_PRICE,
  LAUNCH_PACKAGE_PRICE,
} from '@revealui/contracts/public-catalog';
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

describe('quote calculator (product-site lockstep)', () => {
  it('defaults Who to I will (self-host) on this site', () => {
    expect(DEFAULT_QUOTE_ANSWERS.who).toBe('self');
    expect(QUOTE_CALCULATOR.questions.who.options[0]?.id).toBe('self');
  });

  it('asks exactly three questions with the two exits', () => {
    expect(QUOTE_CALCULATOR.questions.who.label).toBe('Who puts it live?');
    expect(QUOTE_CALCULATOR.questions.what.label).toBe('What has to work?');
    expect(QUOTE_CALCULATOR.questions.places.label).toBe('How many places?');
    expect(QUOTE_CALCULATOR.questions.who.options.map((option) => option.id)).toEqual([
      'self',
      'studio',
    ]);
    expect(QUOTE_CALCULATOR.questions.what.options.map((option) => option.id)).toEqual([
      'hour',
      'plan',
      'launch',
    ]);
    expect(QUOTE_CALCULATOR.questions.what.options.map((option) => option.label)).toEqual([
      'One hour with Joshua (debug / pair)',
      'Architecture artifact bundle and review',
      'One live flow on my accounts',
    ]);
    expect(QUOTE_CALCULATOR.questions.places.options.map((option) => option.id)).toEqual([
      'one',
      'many',
    ]);
    expect(QUOTE_CALCULATOR.questions.places.options[0]?.label).toBe('One business, one place');
  });

  it('locksteps printed numbers to public-catalog and the locked SKU trio', () => {
    expect(QUOTE_CALCULATOR.studio.hour.price).toBe(CONSULTING_HOUR_PRICE);
    expect(QUOTE_CALCULATOR.studio.plan.price).toBe(ARCHITECTURE_REVIEW_PRICE);
    expect(QUOTE_CALCULATOR.studio.launch.price).toBe(LAUNCH_PACKAGE_PRICE);
    expect(QUOTE_CALCULATOR.selfHost.free).toContain(SUBSCRIPTION_PRICE_FALLBACKS.free.price);
    expect(QUOTE_CALCULATOR.selfHost.agents).toContain(SUBSCRIPTION_PRICE_FALLBACKS.pro.price);
    expect(QUOTE_CALCULATOR.selfHost.agents).toContain(SUBSCRIPTION_PRICE_FALLBACKS.max.price);
    expect(QUOTE_CALCULATOR.selfHost.perpetual).toContain(
      PERPETUAL_PRICE_FALLBACKS['Pro Perpetual'].price,
    );
    expect(QUOTE_CALCULATOR.studio.hour.price).toBe('$300');
    expect(QUOTE_CALCULATOR.studio.plan.price).toBe('$3,500');
    expect(QUOTE_CALCULATOR.studio.launch.price).toBe('$7,500');
  });

  it('prints the self-host quote when Who is I will', () => {
    const quote = resolveQuote({ who: 'self', what: 'hour', places: 'one' });
    expect(quote.kind).toBe('self-host');
    expect(quote.title).toBe('Self-host');
    expect(quote.lines).toEqual([
      QUOTE_CALCULATOR.selfHost.free,
      QUOTE_CALCULATOR.selfHost.agents,
      QUOTE_CALCULATOR.selfHost.perpetual,
      QUOTE_CALCULATOR.selfHost.enterprise,
    ]);
    expect(quote.startFreeCta?.href).toBe(SITE.urls.signup);
    expect(quote.lines.join('\n').includes('14-day')).toBe(false);
  });

  it('prints the Studio hour, bundle, and launch quotes', () => {
    const quote = resolveQuote({ who: 'studio', what: 'hour', places: 'one' });
    expect(quote.kind).toBe('studio');
    expect(quote.skus?.map((sku) => [sku.title, sku.price])).toEqual([
      ['Hour', '$300'],
      ['Architecture artifact bundle and review', '$3,500'],
      ['Launch', '$7,500'],
    ]);
    expect(quote.skus?.find((sku) => sku.id === 'hour')?.highlighted).toBe(true);
    expect(quote.lines).toContain(QUOTE_CALCULATOR.studio.hour.body);
    expect(quote.lines).toContain(QUOTE_CALCULATOR.studio.plan.body);
    expect(quote.lines).toContain(QUOTE_CALCULATOR.studio.launch.body);
  });

  it('prints the Studio architecture-bundle quote', () => {
    const quote = resolveQuote({ who: 'studio', what: 'plan', places: 'one' });
    expect(quote.kind).toBe('studio');
    expect(quote.skus?.find((sku) => sku.id === 'plan')?.highlighted).toBe(true);
    expect(quote.skus?.find((sku) => sku.id === 'plan')?.price).toBe('$3,500');
    expect(quote.lines).toContain(QUOTE_CALCULATOR.studio.plan.body);
  });

  it('prints the Studio launch quote', () => {
    const quote = resolveQuote({ who: 'studio', what: 'launch', places: 'one' });
    expect(quote.kind).toBe('studio');
    expect(quote.skus?.find((sku) => sku.id === 'launch')?.highlighted).toBe(true);
    expect(quote.skus?.find((sku) => sku.id === 'launch')?.price).toBe('$7,500');
    expect(quote.lines).toContain(QUOTE_CALCULATOR.studio.launch.body);
  });

  it('stops quoting and books an intro when there is more than one place', () => {
    const selfMany = resolveQuote({ who: 'self', what: 'launch', places: 'many' });
    const studioMany = resolveQuote({ who: 'studio', what: 'hour', places: 'many' });
    expect(selfMany.kind).toBe('intro');
    expect(studioMany.kind).toBe('intro');
    expect(selfMany.title).toBe(QUOTE_CALCULATOR.intro.title);
    expect(selfMany.lines).toContain(QUOTE_CALCULATOR.intro.body);
  });

  it('always carries ownership lines and the Google Calendar intro', () => {
    const answers: QuoteAnswers[] = [
      { who: 'self', what: 'hour', places: 'one' },
      { who: 'studio', what: 'launch', places: 'one' },
      { who: 'studio', what: 'plan', places: 'many' },
    ];
    for (const answer of answers) {
      const quote = resolveQuote(answer);
      expect(quote.ownership).toEqual([...QUOTE_CALCULATOR.ownership]);
      expect(quote.introCta.href).toBe(BOOKING_URL);
      expect(quote.introCta.href).toBe(SITE.urls.bookIntro);
      expect(quote.introCta.href.startsWith('https://calendar.google.com/')).toBe(true);
    }
  });

  it('does not put fleet math, leftover kit prices, or holdback four-tests in the calculator copy', () => {
    const blob = JSON.stringify(QUOTE_CALCULATOR);
    expect(blob.includes('$25,000')).toBe(false);
    expect(blob.includes('$50,000')).toBe(false);
    expect(blob.includes('$8,499')).toBe(false);
    expect(blob.includes('$299')).toBe(true);
    expect(blob.includes('Starter Kit')).toBe(false);
    expect(blob.includes('Agency Founding Kit')).toBe(false);
    expect(blob.includes('Agency Perpetual')).toBe(false);
    expect(blob.includes('https://calendar.google.com/')).toBe(true);
    expect(blob.includes('Fleet from')).toBe(false);
    expect(blob.includes('Custom from')).toBe(false);
    expect(blob.includes('written plan')).toBe(false);
    expect(blob.includes('Written plan')).toBe(false);
    expect(blob.includes('four tests')).toBe(false);
    expect(blob.includes('keep the stack')).toBe(false);
    expect(blob.includes('first half')).toBe(false);
    expect(blob.includes('RevFleet')).toBe(false);
    expect(blob.includes('RevForge')).toBe(false);
    expect(blob.includes('RevKit')).toBe(false);
    expect(blob.includes('Maryville')).toBe(false);
    expect(blob.includes('cal.com')).toBe(false);
    expect(blob.includes('14-day')).toBe(false);
  });
});
