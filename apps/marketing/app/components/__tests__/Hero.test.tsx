import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HOME_HERO } from '../../content/home';
import { Hero } from '../landing/Hero';

afterEach(cleanup);

function renderHero(search = '') {
  const router = new Router();
  // Seed location so selectAudience / selectHomeHero see the same search string.
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

describe('Hero (marketing craft hierarchy)', () => {
  it('renders the L1 H1 with ink (text-foreground), not muted', () => {
    renderHero();
    const h1 = screen.getByRole('heading', { level: 1, name: HOME_HERO.h1 });
    expect(h1.className).toContain('text-foreground');
    expect(h1.className).not.toContain('text-muted-foreground');
  });

  it('uses body text for the subtitle (readable ladder), not muted', () => {
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
    // glowClasses from presentation uses the brand glow token shadow.
    expect(primary.className).toMatch(
      /shadow-\[var\(--rvui-shadow-glow\)\]|shadow-\[var\(--rvui-shadow-glow/,
    );
  });

  it('lists trust signals without brand-dot chrome', () => {
    renderHero();
    expect(screen.getByText('Open source')).toBeInTheDocument();
    expect(screen.getByText('Self-hostable')).toBeInTheDocument();
    expect(screen.getByText('Local-first AI')).toBeInTheDocument();
    // No decorative primary dots in the trust strip (craft: separators only).
    const list = screen.getByText('Open source').closest('ul');
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll('.bg-primary').length ?? 0).toBe(0);
  });

  it('exposes the audience toggle as navigation', () => {
    renderHero();
    expect(screen.getByRole('navigation', { name: 'Choose your view' })).toBeInTheDocument();
  });
});
