import { describe, expect, it } from 'vitest';
import { PRICING_FAQS } from '../pricing-faq';

function lastFaq(): (typeof PRICING_FAQS)[number] {
  const faq = PRICING_FAQS[PRICING_FAQS.length - 1];
  if (!faq) {
    throw new Error('PRICING_FAQS is empty');
  }
  return faq;
}

describe('pricing FAQ RevealFleet honesty', () => {
  it('asks What is RevealFleet, not the RevFleet nickname', () => {
    const faq = lastFaq();
    expect(faq.question).toBe('What is RevealFleet?');
    expect(PRICING_FAQS.some((item) => item.question === 'What is RevFleet?')).toBe(false);
  });

  it('matches studio honesty: family name, buyable RevealUI catalog, RevVault inside Pro', () => {
    const faq = lastFaq();
    const answer = faq.answer;
    expect(answer.includes('RevealUI Studio ships RevealFleet')).toBe(true);
    expect(answer.includes('RevealUI is the lead product')).toBe(true);
    expect(answer.includes('buyable runtime')).toBe(true);
    expect(answer.includes('Free')).toBe(true);
    expect(answer.includes('$49')).toBe(true);
    expect(answer.includes('$299')).toBe(true);
    expect(answer.includes('Enterprise')).toBe(true);
    expect(answer.toLowerCase().includes('inquir')).toBe(true);
    expect(answer.includes('Pro Perpetual')).toBe(true);
    expect(answer.includes('$1,499')).toBe(true);
    expect(answer.includes('RevVault is encrypted secret management inside Pro')).toBe(true);
    expect(answer.includes('not a separate paid SKU')).toBe(true);
  });

  it('keeps the buyable RevealUI catalog in the perpetual-license answer', () => {
    const faq = PRICING_FAQS.find((item) => item.question === 'What are perpetual licenses?');
    expect(faq?.answer.includes('Pro Perpetual')).toBe(true);
    expect(faq?.answer.includes('Studio SKUs live on revealuistudio.com')).toBe(true);
  });

  it('names the perpetual SKU Pro Perpetual, not Perpetual Pro', () => {
    const faq = PRICING_FAQS.find((item) => item.question === 'What are perpetual licenses?');
    expect(faq?.answer.includes('Pro Perpetual')).toBe(true);
    expect(faq?.answer.includes('Perpetual Pro')).toBe(false);
  });

  it('does not sell parked or internal fleet members', () => {
    const blob = PRICING_FAQS.map((item) => `${item.question} ${item.answer}`).join(' ');
    expect(blob.includes('RevFleet')).toBe(false);
    expect(blob.includes('revfleet')).toBe(false);
    expect(blob.includes('RevForge')).toBe(false);
    expect(blob.includes('RevKit')).toBe(false);
    expect(blob.includes('RevDev')).toBe(false);
    expect(blob.includes('RevCon')).toBe(false);
    expect(blob.includes('RevSkills')).toBe(false);
    expect(blob.includes('RevMarket')).toBe(false);
    expect(blob.includes('seven products')).toBe(false);
    expect(blob.includes('Agency Perpetual')).toBe(false);
    expect(blob.includes('$8,499')).toBe(false);
  });
});
