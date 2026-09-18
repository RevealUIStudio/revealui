import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONSULTATION_JOURNEY,
  CONSULTATION_JOURNEY_PROGRESS_KEY,
} from '../../../content/consultation-journey';
import { ConsultationJourney } from '../ConsultationJourney';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('ConsultationJourney', () => {
  it('renders the six Consultation steps in order', () => {
    render(<ConsultationJourney />);
    expect(screen.getByText(CONSULTATION_JOURNEY.heading)).toBeInTheDocument();
    expect(screen.getByText(CONSULTATION_JOURNEY.body)).toBeInTheDocument();
    for (const step of CONSULTATION_JOURNEY.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
      expect(screen.getByText(step.body)).toBeInTheDocument();
    }
  });

  it('persists a completed step when the buyer marks it', () => {
    render(<ConsultationJourney />);
    fireEvent.click(screen.getByRole('button', { name: /Choose/ }));
    expect(localStorage.getItem(CONSULTATION_JOURNEY_PROGRESS_KEY)).toContain('choose');
    expect(screen.getByRole('button', { name: /Choose/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
