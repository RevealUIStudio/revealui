import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SITE } from '../../content/site';
import { ContactPage } from '../ContactPage';
import { RefundPolicyPage } from '../RefundPolicyPage';
import { SecurityPage } from '../SecurityPage';
import { SlaPage } from '../SlaPage';
import { SupportPage } from '../SupportPage';
import { TermsPage } from '../TermsPage';

afterEach(cleanup);

describe('refund and support leftover catalog copy', () => {
  it.each([
    ['support', SupportPage],
    ['SLA', SlaPage],
    ['terms', TermsPage],
  ])(
    'discloses prospective support targets and protects earlier agreements on %s',
    (_name, Page) => {
      const { container } = render(<Page />);
      const text = container.textContent ?? '';
      expect(text).toContain('2026-10-04');
      expect(text).toContain('new purchases made after it is published');
      expect(text).toContain(
        'Agreements accepted before publication retain their stated support commitments',
      );
      expect(text).toContain('not guaranteed response times or guaranteed coverage');
      expect(text).toContain('no backup support staff or on-call rotation');
      expect(text).toContain('24');
      expect(text).toContain('4');
      expect(text).not.toContain('48 business hours');
    },
  );

  it('keeps the infrastructure and maintenance commitments separate from best-effort support', () => {
    const { container } = render(<SlaPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('99% uptime, measured monthly');
    expect(text).toContain('at least 48 hours of advance notice');
    expect(text).toContain('within 24 hours for requests received on weekdays');
    expect(text).toContain('9am to 5pm U.S. Central Time');
    expect(text).not.toContain('actual uptime is typically');
    expect(text).not.toContain('We often beat');
  });

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
    expect(
      screen.getByRole('heading', { level: 1, name: 'Talk to the RevealUI team.' }),
    ).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('discuss Enterprise');
    expect(container.textContent ?? '').not.toContain('custom pricing');
    expect(container.textContent ?? '').not.toContain('Custom Pricing');
    expect(container.textContent ?? '').not.toContain('Custom SKU');
    const topic = screen.getByLabelText('Topic');
    const options = [...topic.querySelectorAll('option')].map((option) => option.textContent ?? '');
    expect(options[0]).toBe('General Question');
    expect(options.includes('Enterprise')).toBe(true);
    expect(options.some((label) => label.includes('Custom'))).toBe(false);
  });

  it('renders the on-site Security summary and links GitHub reporting', () => {
    const { container } = render(<SecurityPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Security' })).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('on-site policy summary');
    expect(container.textContent ?? '').not.toContain('SOC 2 certified');
    const faq = screen.getByRole('heading', { level: 2, name: '7. Compliance FAQ' });
    expect(faq.parentElement?.textContent).toContain('We do not currently hold SOC 2');
    expect(faq.parentElement?.textContent).toContain('we will publish progress');
    const question = screen.getByText('What is your independent-assessment status?');
    expect(question.tagName).toBe('SUMMARY');
    expect(question.closest('details')).not.toHaveAttribute('open');
    const github = screen.getByRole('link', { name: 'GitHub Security Advisories' });
    expect(github.getAttribute('href')).toBe(SITE.urls.repoSecurity);
  });

  it('does not sell Starter Kit or invent a buyer community on support', () => {
    const { container } = render(<SupportPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('Starter Kit');
    expect(container.textContent ?? '').not.toContain('Paid product buyers (Starter Kit');
    expect(container.textContent ?? '').not.toContain('Skool buyer community');
    expect(screen.queryByRole('link', { name: 'Join Skool' })).toBeNull();
  });

  it('renders support channels as labeled links without raw markdown or bare URLs', () => {
    const { container } = render(<SupportPage />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('**');
    expect(text).not.toContain('https://github.com/RevealUIStudio/revealui/discussions');
    expect(text).not.toContain('https://docs.revealui.com');

    const docsLinks = screen.getAllByRole('link', { name: 'Documentation' });
    expect(docsLinks.length).toBeGreaterThanOrEqual(1);
    expect(
      docsLinks.every((link) => link.getAttribute('href') === 'https://docs.revealui.com'),
    ).toBe(true);
    const discussions = screen.getByRole('link', { name: 'GitHub Discussions' });
    expect(discussions).toHaveAttribute(
      'href',
      'https://github.com/RevealUIStudio/revealui/discussions',
    );
    const issues = screen.getByRole('link', { name: 'GitHub Issues' });
    expect(issues).toHaveAttribute('href', 'https://github.com/RevealUIStudio/revealui/issues');
    expect(screen.getByRole('link', { name: 'SLA page' })).toHaveAttribute(
      'href',
      'https://revealui.com/sla',
    );
    expect(screen.getByText('create-revealui').tagName).toBe('CODE');

    const prose = container.querySelector('[data-slot="markdown-text"]');
    expect(prose?.className).toContain('wrap-anywhere');
    expect(prose?.className).toContain('break-words');
  });
});
