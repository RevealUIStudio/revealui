/**
 * LinkButton Component Tests
 *
 * Tests for the LinkButton component exported from
 * packages/presentation/src/components/LinkButton.tsx.
 *
 * Covers: default <a> rendering, LinkBehaviorProvider wiring, polymorphic
 * `as` override, external links, disabled state, isLoading state.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LinkButton } from '../../components/LinkButton.js';
import { LinkBehaviorProvider } from '../../hooks/use-link-behavior.js';

describe('LinkButton', () => {
  // -------------------------------------------------------------------------
  // Default rendering — native <a>
  // -------------------------------------------------------------------------

  describe('Default rendering', () => {
    it('renders an <a> element with href', () => {
      render(<LinkButton href="/contact">Book a call</LinkButton>);
      const link = screen.getByRole('link', { name: /book a call/i });
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/contact');
    });

    it('renders text content', () => {
      render(<LinkButton href="/x">Get Started</LinkButton>);
      expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
    });

    it('applies default variant classes (bg-primary)', () => {
      render(<LinkButton href="/x">Default</LinkButton>);
      expect(screen.getByRole('link')).toHaveClass('bg-primary');
    });

    it('applies size class', () => {
      render(
        <LinkButton href="/x" size="lg">
          Large
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveClass('h-11');
    });

    it('applies variant class', () => {
      render(
        <LinkButton href="/x" variant="outline">
          Outlined
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveClass('border', 'border-border');
    });

    it('merges consumer className with button classes', () => {
      render(
        <LinkButton href="/x" className="my-extra-class">
          Merged
        </LinkButton>,
      );
      const link = screen.getByRole('link');
      expect(link).toHaveClass('my-extra-class');
      expect(link).toHaveClass('bg-primary'); // default variant still applied
    });
  });

  // -------------------------------------------------------------------------
  // LinkBehaviorProvider — context-based wiring
  // -------------------------------------------------------------------------

  describe('LinkBehaviorProvider', () => {
    interface CustomLinkProps {
      to: string;
      className?: string;
      children?: React.ReactNode;
    }
    function CustomLink({ to, className, children, ...rest }: CustomLinkProps) {
      // Renders as a <span> so we can prove it isn't the default <a>
      return (
        <span data-testid="custom-link" data-to={to} className={className} {...rest}>
          {children}
        </span>
      );
    }

    it('renders the provider component instead of <a>', () => {
      render(
        <LinkBehaviorProvider component={CustomLink} hrefProp="to">
          <LinkButton href="/contact">Book</LinkButton>
        </LinkBehaviorProvider>,
      );
      expect(screen.getByTestId('custom-link')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('passes the URL via the configured hrefProp ("to" instead of "href")', () => {
      render(
        <LinkBehaviorProvider component={CustomLink} hrefProp="to">
          <LinkButton href="/contact">Book</LinkButton>
        </LinkBehaviorProvider>,
      );
      const el = screen.getByTestId('custom-link');
      expect(el).toHaveAttribute('data-to', '/contact');
    });

    it('still applies button styling on the provider component', () => {
      render(
        <LinkBehaviorProvider component={CustomLink} hrefProp="to">
          <LinkButton href="/contact" variant="primary">
            Book
          </LinkButton>
        </LinkBehaviorProvider>,
      );
      const el = screen.getByTestId('custom-link');
      expect(el).toHaveClass('bg-primary');
    });
  });

  // -------------------------------------------------------------------------
  // Polymorphic `as` prop — per-instance override
  // -------------------------------------------------------------------------

  describe('Polymorphic `as` prop', () => {
    it('renders the component passed via `as`', () => {
      render(
        <LinkButton as="button" type="button">
          Button-shaped
        </LinkButton>,
      );
      expect(screen.getByRole('button', { name: /button-shaped/i })).toBeInTheDocument();
    });

    it('drops back to "href" prop when `as` is set (regardless of provider hrefProp)', () => {
      function CustomLink(props: { to?: string; href?: string; children?: React.ReactNode }) {
        return (
          <span data-testid="instance-link" data-to={props.to} data-href={props.href}>
            {props.children}
          </span>
        );
      }
      render(
        <LinkBehaviorProvider component="span" hrefProp="to">
          {/* `as` override should use 'href', not 'to' */}
          <LinkButton as={CustomLink} href="/x">
            Override
          </LinkButton>
        </LinkBehaviorProvider>,
      );
      const el = screen.getByTestId('instance-link');
      expect(el).toHaveAttribute('data-href', '/x');
      expect(el).not.toHaveAttribute('data-to');
    });
  });

  // -------------------------------------------------------------------------
  // External links — opt out of provider Link
  // -------------------------------------------------------------------------

  describe('External links', () => {
    it('renders a native <a> even inside a LinkBehaviorProvider', () => {
      function CustomLink(props: { to: string; children?: React.ReactNode }) {
        return <span data-testid="custom-link">{props.children}</span>;
      }
      render(
        <LinkBehaviorProvider component={CustomLink} hrefProp="to">
          <LinkButton href="https://x.com" external>
            Tweet
          </LinkButton>
        </LinkBehaviorProvider>,
      );
      expect(screen.queryByTestId('custom-link')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /tweet/i }).tagName).toBe('A');
    });

    it('adds target="_blank" rel="noopener noreferrer"', () => {
      render(
        <LinkButton href="https://x.com" external>
          Tweet
        </LinkButton>,
      );
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // -------------------------------------------------------------------------
  // Disabled state
  // -------------------------------------------------------------------------

  describe('Disabled state', () => {
    it('sets aria-disabled="true"', () => {
      render(
        <LinkButton href="/x" disabled>
          Disabled
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveAttribute('aria-disabled', 'true');
    });

    it('sets tabIndex={-1}', () => {
      render(
        <LinkButton href="/x" disabled>
          Disabled
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveAttribute('tabindex', '-1');
    });

    it('preserves the href (does not silently change anchor semantics)', () => {
      render(
        <LinkButton href="/contact" disabled>
          Disabled
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveAttribute('href', '/contact');
    });

    it('prevents default on click', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <LinkButton href="/x" disabled onClick={onClick}>
          Disabled
        </LinkButton>,
      );
      await user.click(screen.getByRole('link'));
      // Our onClick is overridden by the disabled handler — the consumer's
      // onClick is overwritten by the spread order. This is intentional:
      // disabled means disabled.
      expect(onClick).not.toHaveBeenCalled();
    });

    it('applies opacity and pointer-events-none styling', () => {
      render(
        <LinkButton href="/x" disabled>
          Disabled
        </LinkButton>,
      );
      const link = screen.getByRole('link');
      expect(link).toHaveClass('opacity-50');
      expect(link).toHaveClass('pointer-events-none');
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('Loading state', () => {
    it('sets aria-busy="true"', () => {
      render(
        <LinkButton href="/x" isLoading>
          Loading
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveAttribute('aria-busy', 'true');
    });

    it('renders a spinner element', () => {
      const { container } = render(
        <LinkButton href="/x" isLoading>
          Loading
        </LinkButton>,
      );
      expect(container.querySelector('svg.animate-spin')).toBeInTheDocument();
    });

    it('applies pointer-events-none', () => {
      render(
        <LinkButton href="/x" isLoading>
          Loading
        </LinkButton>,
      );
      expect(screen.getByRole('link')).toHaveClass('pointer-events-none');
    });

    it('does not render spinner when isLoading is false', () => {
      const { container } = render(<LinkButton href="/x">Idle</LinkButton>);
      expect(container.querySelector('svg.animate-spin')).not.toBeInTheDocument();
    });
  });
});
