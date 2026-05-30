import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NavBar } from '../NavBar';

afterEach(cleanup);

const MENU_ID = 'marketing-mobile-menu';

// NavBar now navigates via the router (Link + useLocation), so it must render
// inside a RouterProvider.
function renderNavBar() {
  return render(
    <RouterProvider router={new Router()}>
      <NavBar />
    </RouterProvider>,
  );
}

describe('NavBar (marketing)', () => {
  it('renders a 44x44 hamburger wired as an ARIA disclosure trigger', () => {
    renderNavBar();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    // WCAG 2.5.5 / Apple HIG minimum 44x44 tap target.
    expect(toggle.className).toContain('h-11');
    expect(toggle.className).toContain('w-11');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', MENU_ID);
    expect(document.getElementById(MENU_ID)).not.toBeInTheDocument();
  });

  it('opens the menu and points the trigger at it via aria-controls/id', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = document.getElementById(MENU_ID);
    expect(menu).toBeInTheDocument();

    // Two "Close menu" buttons exist while open (trigger + backdrop); the
    // trigger is the one carrying aria-expanded.
    const toggle = screen.getByRole('button', { name: 'Close menu', expanded: true });
    expect(toggle).toHaveAttribute('aria-controls', MENU_ID);
  });

  it('gives every mobile menu link a >=44px tap target', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const links = document.getElementById(MENU_ID)?.querySelectorAll('a') ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      // Plain text links use py-3 (~44px); the signup LinkButton uses h-11 (44px).
      const meetsTarget = link.className.includes('py-3') || link.className.includes('h-11');
      expect(meetsTarget, `link "${link.textContent?.trim()}" must be >=44px`).toBe(true);
    }
  });

  it('closes the menu when Escape is pressed', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.getElementById(MENU_ID)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById(MENU_ID)).not.toBeInTheDocument();
  });

  it('closes the menu when the backdrop is tapped (tap-outside)', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const closers = screen.getAllByRole('button', { name: 'Close menu' });
    expect(closers).toHaveLength(2);
    const backdrop = closers.find((b) => !b.hasAttribute('aria-expanded'));
    expect(backdrop).toBeDefined();

    fireEvent.click(backdrop as HTMLElement);
    expect(document.getElementById(MENU_ID)).not.toBeInTheDocument();
  });

  it('locks body scroll while open and restores it on close', () => {
    renderNavBar();
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });

  it('routes internal nav links through the SPA router; external links stay anchors', () => {
    renderNavBar();
    // Internal route -> router Link that intercepts the click (no full reload).
    const pricing = screen.getByRole('link', { name: 'Pricing' });
    expect(pricing).toHaveAttribute('href', '/pricing');
    expect(fireEvent.click(pricing)).toBe(false); // default prevented = intercepted

    // Absolute URL -> plain anchor, left for a full-page load.
    const docs = screen.getByRole('link', { name: 'Docs' });
    expect(docs).toHaveAttribute('href', 'https://docs.revealui.com');
  });
});
