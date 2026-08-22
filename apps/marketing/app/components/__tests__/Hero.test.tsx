import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HOME_GET_STARTED, HOME_HERO } from '../../content/home';
import { Hero } from '../landing/Hero';

afterEach(cleanup);

function renderHero(search = '') {
  const router = new Router();
  if (search) {
    window.history.replaceState({}, '', `/${search.startsWith('?') ? search : `?${search}`}`);
  } else {
    window.history.replaceState({}, '', '/');
  }
  return render(
    <RouterProvider router={router}>
      <Hero />
    </RouterProvider>,
  );
}

describe('Hero (product homepage)', () => {
  it('renders the L1 H1 with ink (text-foreground), not muted', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1, name: HOME_HERO.h1 });
    expect(h1.className).toContain('text-foreground');
    expect(h1.className).not.toContain('text-muted-foreground');
  });

  it('uses body text for the continuity sentence, not muted', () => {
    renderHero();
    const subtitle = screen.getByText(HOME_HERO.subtitle.sentence1, { exact: false });
    expect(subtitle.className).toContain('text-body');
    expect(subtitle.className).not.toContain('text-muted-foreground');
  });

  it('renders primary CTA as a solid brand control with glow emphasis', () => {
    renderHero();
    const primary = screen.getByRole('link', {
      name: new RegExp(HOME_HERO.cta.primary.label, 'i'),
    });
    expect(primary.className).toMatch(
      /shadow-\[var\(--rvui-shadow-glow\)\]|shadow-\[var\(--rvui-shadow-glow/,
    );
  });

  it('shows Start free, GitHub, and the create-revealui command', () => {
    renderHero();
    expect(screen.getByRole('link', { name: /start free/i })).toHaveAttribute(
      'href',
      HOME_HERO.cta.primary.href,
    );
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      HOME_HERO.cta.secondary.href,
    );
    expect(screen.getByText(HOME_GET_STARTED.cli.command[0] ?? 'npx')).toBeInTheDocument();
  });

  it('does not expose an audience toggle', () => {
    renderHero();
    expect(screen.queryByRole('navigation', { name: 'Choose your view' })).toBeNull();
  });

  it('uses a viewport-stage shell with full-bleed backdrop (not content-boxed paint)', () => {
    const { container } = renderHero();
    const section = container.querySelector('[data-slot="marketing-section"]');
    expect(section).toBeTruthy();
    expect(section).toHaveAttribute('data-has-backdrop', 'true');
    expect(section?.className).toMatch(/min-h-\[calc\(100svh-var\(--marketing-nav-h/);
    const backdrop = container.querySelector('[data-slot="hero-background"]');
    expect(backdrop).toBeTruthy();
    expect(backdrop?.parentElement).toBe(section);
  });
});
