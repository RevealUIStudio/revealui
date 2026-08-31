import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TEMPLATES_APIFY,
  TEMPLATES_CLI,
  TEMPLATES_CLI_ITEMS,
  TEMPLATES_HERO,
  TEMPLATES_VERCEL,
} from '../../content/templates';
import { TemplatesPage } from '../TemplatesPage';

afterEach(cleanup);

describe('TemplatesPage', () => {
  it('renders the CLI command, five templates, and GitHub twins', () => {
    render(<TemplatesPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: TEMPLATES_HERO.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(TEMPLATES_CLI.command)).toBeInTheDocument();
    expect(screen.getByText('0.5.22', { exact: false })).toBeInTheDocument();
    for (const item of TEMPLATES_CLI_ITEMS) {
      expect(screen.getByRole('heading', { name: item.name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Use this template: basic-blog' })).toHaveAttribute(
      'href',
      'https://github.com/RevealUIStudio/revealui-template-basic-blog',
    );
    expect(screen.queryByRole('link', { name: 'Use this template: starter-native' })).toBeNull();
    expect(screen.getByText('No GitHub twin', { exact: false })).toBeInTheDocument();
  });

  it('links the Apify actor and prints billed verify', () => {
    const { container } = render(<TemplatesPage />);
    const apify = screen.getByRole('link', { name: TEMPLATES_APIFY.cta });
    expect(apify).toHaveAttribute('href', TEMPLATES_APIFY.href);
    expect(container.textContent ?? '').toContain('$0.02');
    expect(container.textContent ?? '').toContain('$0.08');
    expect(container.textContent ?? '').toContain('$0.00001');
    expect(container.textContent ?? '').toContain('not free');
    expect((container.textContent ?? '').toLowerCase().includes('verify is free')).toBe(false);
  });

  it('offers Deploy to Vercel on the buyer clone URL', () => {
    render(<TemplatesPage />);
    const deploy = screen.getByRole('link', { name: TEMPLATES_VERCEL.cta });
    expect(deploy).toHaveAttribute('href', TEMPLATES_VERCEL.href);
    expect(deploy.getAttribute('href')?.startsWith('https://vercel.com/new/clone?')).toBe(true);
    const twin = screen.getByRole('link', { name: TEMPLATES_VERCEL.sourceLabel });
    expect(twin).toHaveAttribute('href', TEMPLATES_VERCEL.sourceHref);
  });

  it('does not link dead hosts or leftover kits', () => {
    const { container } = render(<TemplatesPage />);
    const html = container.innerHTML;
    const text = container.textContent ?? '';
    expect(html.includes('railway')).toBe(false);
    expect(html.includes('pikapods')).toBe(false);
    expect(html.includes('elest.io')).toBe(false);
    expect(text.includes('RevForge')).toBe(false);
    expect(text.includes('RevKit')).toBe(false);
    expect(text.includes('Agency Founding Kit')).toBe(false);
    expect(text.includes('Architecture Review')).toBe(false);
    expect(html.includes('cal.com')).toBe(false);
  });
});
