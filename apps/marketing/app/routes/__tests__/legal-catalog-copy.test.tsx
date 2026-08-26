import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContactPage } from '../ContactPage';
import { RefundPolicyPage } from '../RefundPolicyPage';
import { SupportPage } from '../SupportPage';

afterEach(cleanup);

describe('refund and support leftover catalog copy', () => {
  it('keeps 14-day license refunds and does not list Starter Kit or named invoice SKUs', () => {
    const { container } = render(<RefundPolicyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Refund Policy' })).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('14 days of purchase');
    expect(
      screen.queryByRole('heading', { name: '3. Starter Kit (content-only product)' }),
    ).toBeNull();
    expect(container.textContent ?? '').not.toContain('Starter Kit');
    expect(container.textContent ?? '').not.toContain('Architecture Review');
    expect(container.textContent ?? '').not.toContain('Fleet deployment');
    expect(container.textContent ?? '').not.toContain('Custom Build');
    expect(container.textContent ?? '').not.toContain('Agency Perpetual');
    expect(container.textContent ?? '').not.toContain('Agency,');
    expect(container.textContent ?? '').not.toContain('first-sale walk');
    expect(container.textContent ?? '').not.toContain('No holdback');
  });

  it('lets Enterprise inquire without leading a Custom SKU', () => {
    const { container } = render(<ContactPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Get in touch' })).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('Interested in Enterprise?');
    expect(container.textContent ?? '').not.toContain('custom pricing');
    expect(container.textContent ?? '').not.toContain('Custom Pricing');
    expect(container.textContent ?? '').not.toContain('Custom SKU');
    const topic = screen.getByLabelText('Topic');
    const options = [...topic.querySelectorAll('option')].map((option) => option.textContent ?? '');
    expect(options[0]).toBe('General Question');
    expect(options.includes('Enterprise')).toBe(true);
    expect(options.some((label) => label.includes('Custom'))).toBe(false);
  });

  it('does not sell Starter Kit or invent a buyer community on support', () => {
    const { container } = render(<SupportPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('Starter Kit');
    expect(container.textContent ?? '').not.toContain('Paid product buyers (Starter Kit');
    expect(container.textContent ?? '').not.toContain('Skool buyer community');
    expect(screen.queryByRole('link', { name: 'Join Skool' })).toBeNull();
  });
});
