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
    // Button size="icon" applies size-11 (2.75rem = 44px square).
    expect(toggle.className).toContain('size-11');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', MENU_ID);
    expect(document.getElementById(MENU_ID)).not.toBeInTheDocument();
  });

  it('opens the menu and points the trigger at it via aria-controls/id', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = document.getElementById(MENU_ID);
    expect(menu).toBeInTheDocument();

    // The hamburger trigger flips to "Close menu" + aria-expanded while open.
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

  it('closes the menu on a pointer-down outside the panel (tap-outside)', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.getElementById(MENU_ID)).toBeInTheDocument();

    // Tap-outside is handled by useClickOutside (capture-phase pointerdown), not
    // a visual backdrop — a fixed backdrop would be clipped by the sticky
    // header's backdrop-blur containing block. A pointerdown on the document
    // body (outside both the menu panel and the toggle) closes the menu.
    fireEvent.pointerDown(document.body);
    expect(document.getElementById(MENU_ID)).not.toBeInTheDocument();
  });

  it('keeps the menu open on a pointer-down inside the panel', () => {
    renderNavBar();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = document.getElementById(MENU_ID);
    expect(menu).toBeInTheDocument();

    fireEvent.pointerDown(menu as HTMLElement);
    expect(document.getElementById(MENU_ID)).toBeInTheDocument();
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

  it('marks the home brand link as the current page on /', () => {
    window.history.pushState({}, '', '/');
    renderNavBar();
    const home = screen.getByRole('link', { name: 'RevealUI' });
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the nav logo-only with no visible product wordmark', () => {
    renderNavBar();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).not.toHaveTextContent('RevealUI');
    expect(nav).not.toHaveTextContent('RevealUI Studio');
    expect(screen.getByRole('link', { name: 'RevealUI' })).toBeInTheDocument();
  });

  it('marks the active desktop route with aria-current=page', () => {
    window.history.pushState({}, '', '/pricing');
    renderNavBar();
    const pricing = screen.getByRole('link', { name: 'Pricing' });
    expect(pricing).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Products' })).toBeNull();
  });

  it('exposes primary navigation landmark', () => {
    renderNavBar();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});
