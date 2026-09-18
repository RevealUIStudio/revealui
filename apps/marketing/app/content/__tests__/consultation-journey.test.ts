import { CONSULTATION_PRICE } from '@revealui/contracts/public-catalog';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONSULTATION_JOURNEY,
  CONSULTATION_JOURNEY_PROGRESS_KEY,
  CONSULTATION_STEP_IDS,
  parseConsultationProgress,
  readConsultationProgress,
  toggleConsultationStep,
  writeConsultationProgress,
} from '../consultation-journey';

afterEach(() => {
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('CONSULTATION_JOURNEY', () => {
  it('follows choose → pay → prep → session → artifacts → next', () => {
    expect(CONSULTATION_JOURNEY.steps.map((step) => step.id)).toEqual([...CONSULTATION_STEP_IDS]);
    expect(CONSULTATION_STEP_IDS).toEqual([
      'choose',
      'pay',
      'prep',
      'session',
      'artifacts',
      'next',
    ]);
  });

  it('pins Consultation at $300 with vendor-agnostic session copy', () => {
    const blob = JSON.stringify(CONSULTATION_JOURNEY);
    expect(CONSULTATION_JOURNEY.steps[1]?.body).toContain(CONSULTATION_PRICE);
    expect(CONSULTATION_PRICE).toBe('$300');
    expect(CONSULTATION_JOURNEY.steps[3]?.body).toContain('video session');
    expect(CONSULTATION_JOURNEY.steps[3]?.body).toContain('consent');
    expect(blob.includes('Google Meet')).toBe(false);
    expect(blob.includes('Cal.com')).toBe(false);
    expect(blob.includes('HubSpot')).toBe(false);
    expect(blob.includes('autodialer')).toBe(false);
    expect(blob.includes('Zoom')).toBe(false);
    expect(blob.includes('OBS')).toBe(false);
    expect(blob.toLowerCase().includes('soc2')).toBe(false);
    expect(blob.toLowerCase().includes('soc 2')).toBe(false);
    expect(blob.includes('CapCut')).toBe(false);
  });

  it('does not invent a fourth SKU', () => {
    const blob = JSON.stringify(CONSULTATION_JOURNEY);
    expect(blob).toContain('no fourth product');
    expect(blob.includes('Videos SKU')).toBe(false);
    expect(blob.includes('Contents SKU')).toBe(false);
  });

  it('persists completed steps in localStorage', () => {
    const next = toggleConsultationStep({ completed: [] }, 'choose');
    writeConsultationProgress(next);
    expect(readConsultationProgress().completed).toEqual(['choose']);
    expect(localStorage.getItem(CONSULTATION_JOURNEY_PROGRESS_KEY)).toContain('choose');
    expect(parseConsultationProgress({ completed: ['pay', 'unknown'] }).completed).toEqual(['pay']);
  });
});
