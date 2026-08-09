/**
 * SidebarLayout Component Tests
 *
 * Tests the SidebarLayout component which provides a sidebar + navbar + main
 * content layout with responsive mobile sidebar support.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SidebarLayout } from '../../components/sidebar-layout.js';

describe('SidebarLayout', () => {
  it('should render children in main', () => {
    render(
      <SidebarLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Main content</p>
      </SidebarLayout>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Main content');
  });

  it('should render sidebar content', () => {
    render(
      <SidebarLayout navbar={<div>Nav</div>} sidebar={<div>Sidebar items</div>}>
        <p>Content</p>
      </SidebarLayout>,
    );
    expect(screen.getByText('Sidebar items')).toBeInTheDocument();
  });

  it('should render navbar content', () => {
    render(
      <SidebarLayout navbar={<div>Navbar content</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </SidebarLayout>,
    );
    expect(screen.getByText('Navbar content')).toBeInTheDocument();
  });

  it('should have a header element', () => {
    render(
      <SidebarLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </SidebarLayout>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('should have a main element', () => {
    render(
      <SidebarLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </SidebarLayout>,
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('constrains the shell so nested flex content cannot force page x-scroll', () => {
    const { container } = render(
      <SidebarLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </SidebarLayout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/overflow-x-hidden/);
    expect(root.className).toMatch(/max-w-\[100vw\]/);
    const main = screen.getByRole('main');
    expect(main.className).toMatch(/min-w-0/);
  });
});
