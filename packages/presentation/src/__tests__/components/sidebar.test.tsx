/**
 * Sidebar Component Tests
 *
 * Tests the Sidebar compound component including Sidebar, SidebarHeader,
 * SidebarBody, SidebarFooter, SidebarSection, SidebarDivider, SidebarSpacer,
 * SidebarHeading, SidebarItem, and SidebarLabel.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Sidebar,
  SidebarBody,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSpacer,
} from '../../components/sidebar.js';

describe('Sidebar', () => {
  it('should render a nav element', () => {
    render(<Sidebar data-testid="sidebar">Content</Sidebar>);
    expect(screen.getByTestId('sidebar').tagName).toBe('NAV');
  });

  it('should render children', () => {
    render(<Sidebar>Sidebar content</Sidebar>);
    expect(screen.getByText('Sidebar content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <Sidebar className="custom-sidebar" data-testid="sidebar">
        Content
      </Sidebar>,
    );
    expect(screen.getByTestId('sidebar')).toHaveClass('custom-sidebar');
  });
});

describe('SidebarHeader', () => {
  it('should render children in a div', () => {
    render(<SidebarHeader data-testid="header">Header content</SidebarHeader>);
    const header = screen.getByTestId('header');
    expect(header.tagName).toBe('DIV');
    expect(header).toHaveTextContent('Header content');
  });
});

describe('SidebarBody', () => {
  it('should render children in a div', () => {
    render(<SidebarBody data-testid="body">Body content</SidebarBody>);
    const body = screen.getByTestId('body');
    expect(body.tagName).toBe('DIV');
    expect(body).toHaveTextContent('Body content');
  });
});

describe('SidebarFooter', () => {
  it('should render children in a div', () => {
    render(<SidebarFooter data-testid="footer">Footer content</SidebarFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer.tagName).toBe('DIV');
    expect(footer).toHaveTextContent('Footer content');
  });
});

describe('SidebarDivider', () => {
  it('should render an hr element', () => {
    render(<SidebarDivider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
});

describe('SidebarSpacer', () => {
  it('should have aria-hidden set to true', () => {
    render(<SidebarSpacer data-testid="spacer" />);
    expect(screen.getByTestId('spacer')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('SidebarHeading', () => {
  it('should render an h3 element', () => {
    render(<SidebarHeading>Navigation</SidebarHeading>);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Navigation');
  });
});

describe('SidebarItem', () => {
  it('should render as a button when no href is provided', () => {
    render(<SidebarItem>Dashboard</SidebarItem>);
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('should render as a link when href is provided', () => {
    render(<SidebarItem href="/dashboard">Dashboard</SidebarItem>);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('should set data-current when current prop is true', () => {
    render(
      <SidebarItem href="/home" current>
        Home
      </SidebarItem>,
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveAttribute('data-current', 'true');
  });

  it('should not set data-current when current is not provided', () => {
    render(<SidebarItem href="/about">About</SidebarItem>);
    const link = screen.getByRole('link', { name: 'About' });
    expect(link).not.toHaveAttribute('data-current');
  });

  it('should handle click events on button variant', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SidebarItem onClick={onClick}>Click Me</SidebarItem>);

    await user.click(screen.getByRole('button', { name: 'Click Me' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('SidebarLabel', () => {
  it('should render a span element', () => {
    render(<SidebarLabel data-testid="label">Label text</SidebarLabel>);
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveTextContent('Label text');
  });

  it('should apply truncate class', () => {
    render(<SidebarLabel data-testid="label">Long label</SidebarLabel>);
    expect(screen.getByTestId('label')).toHaveClass('truncate');
  });
});
