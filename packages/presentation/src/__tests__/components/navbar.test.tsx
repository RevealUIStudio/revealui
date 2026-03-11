/**
 * Navbar Component Tests
 *
 * Tests the Navbar compound component including Navbar, NavbarSection,
 * NavbarItem, NavbarSpacer, NavbarDivider, and NavbarLabel.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from '../../components/navbar.js';

describe('Navbar', () => {
  it('should render a nav element', () => {
    render(<Navbar data-testid="navbar">Content</Navbar>);
    expect(screen.getByTestId('navbar').tagName).toBe('NAV');
  });

  it('should render children', () => {
    render(<Navbar>Nav content</Navbar>);
    expect(screen.getByText('Nav content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <Navbar className="custom-nav" data-testid="navbar">
        Content
      </Navbar>,
    );
    expect(screen.getByTestId('navbar')).toHaveClass('custom-nav');
  });
});

describe('NavbarSection', () => {
  it('should render children in a div', () => {
    render(<NavbarSection data-testid="section">Section items</NavbarSection>);
    expect(screen.getByTestId('section')).toHaveTextContent('Section items');
  });
});

describe('NavbarItem', () => {
  it('should render as a button by default', () => {
    render(<NavbarItem>Dashboard</NavbarItem>);
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('should render as a link when href is provided', () => {
    render(<NavbarItem href="/dashboard">Dashboard</NavbarItem>);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('should set data-current when current prop is true', () => {
    render(
      <NavbarItem href="/home" current>
        Home
      </NavbarItem>,
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveAttribute('data-current', 'true');
  });

  it('should not set data-current when current prop is false', () => {
    render(<NavbarItem href="/about">About</NavbarItem>);
    const link = screen.getByRole('link', { name: 'About' });
    expect(link).not.toHaveAttribute('data-current');
  });

  it('should handle click events on button variant', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NavbarItem onClick={onClick}>Click Me</NavbarItem>);

    await user.click(screen.getByRole('button', { name: 'Click Me' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('NavbarSpacer', () => {
  it('should render a div with aria-hidden', () => {
    render(<NavbarSpacer data-testid="spacer" />);
    const spacer = screen.getByTestId('spacer');
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('NavbarDivider', () => {
  it('should render a div with aria-hidden', () => {
    render(<NavbarDivider data-testid="divider" />);
    const divider = screen.getByTestId('divider');
    expect(divider).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('NavbarLabel', () => {
  it('should render a span element', () => {
    render(<NavbarLabel data-testid="label">Label text</NavbarLabel>);
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveTextContent('Label text');
  });

  it('should apply truncate class', () => {
    render(<NavbarLabel data-testid="label">Long label</NavbarLabel>);
    expect(screen.getByTestId('label')).toHaveClass('truncate');
  });
});

describe('Navbar composition', () => {
  it('should render a complete navbar layout', () => {
    render(
      <Navbar>
        <NavbarSection>
          <NavbarItem href="/" current>
            <NavbarLabel>Home</NavbarLabel>
          </NavbarItem>
          <NavbarItem href="/about">
            <NavbarLabel>About</NavbarLabel>
          </NavbarItem>
        </NavbarSection>
        <NavbarSpacer />
        <NavbarDivider />
        <NavbarSection>
          <NavbarItem href="/settings">
            <NavbarLabel>Settings</NavbarLabel>
          </NavbarItem>
        </NavbarSection>
      </Navbar>,
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
