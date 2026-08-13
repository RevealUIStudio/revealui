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

  it('lists trust signals without brand-dot chrome (sm+; hidden on phone)', () => {
    renderHero();
    // Present in DOM for a11y/desktop; `hidden sm:flex` demotes phone chrome.
    const openSource = screen.getByText('Open source');
    expect(openSource).toBeInTheDocument();
    expect(screen.getByText('Self-hostable')).toBeInTheDocument();
    expect(screen.getByText('Local-first AI')).toBeInTheDocument();
    const list = openSource.closest('ul');
    expect(list).toBeTruthy();
    expect(list?.className).toMatch(/hidden/);
    expect(list?.className).toMatch(/sm:flex/);
    expect(list?.querySelectorAll('.bg-primary').length ?? 0).toBe(0);
  });

  it('exposes the audience toggle as navigation', () => {
    renderHero();
    expect(screen.getByRole('navigation', { name: 'Choose your view' })).toBeInTheDocument();
  });

  it('uses a viewport-stage shell with full-bleed backdrop (not content-boxed paint)', () => {
    const { container } = renderHero();
    const section = container.querySelector('[data-slot="marketing-section"]');
    expect(section).toBeTruthy();
    expect(section).toHaveAttribute('data-has-backdrop', 'true');
    // min-height fills remaining viewport under sticky nav.
    expect(section?.className).toMatch(/min-h-\[calc\(100svh-var\(--marketing-nav-h/);
    const backdrop = container.querySelector('[data-slot="hero-background"]');
    expect(backdrop).toBeTruthy();
    // Backdrop is a direct child of the outer section (full bleed), not the max-w rail.
    expect(backdrop?.parentElement).toBe(section);
  });
});
