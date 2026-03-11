/**
 * Badge Component Tests
 *
 * Tests the Badge and BadgeButton components for rendering,
 * color variants, and interactive behavior.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge, BadgeButton } from '../../components/badge';

describe('Badge', () => {
  describe('Rendering', () => {
    it('should render with text content', () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render as a span element', () => {
      render(<Badge>Status</Badge>);
      const badge = screen.getByText('Status');
      expect(badge.tagName).toBe('SPAN');
    });

    it('should apply custom className', () => {
      render(<Badge className="custom-class">Test</Badge>);
      expect(screen.getByText('Test')).toHaveClass('custom-class');
    });

    it('should apply base styles', () => {
      render(<Badge>Base</Badge>);
      const badge = screen.getByText('Base');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('rounded-md');
      expect(badge).toHaveClass('font-medium');
    });
  });

  describe('Color Variants', () => {
    it('should default to zinc color', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge.className).toContain('bg-zinc');
    });

    it('should apply red color variant', () => {
      render(<Badge color="red">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge.className).toContain('bg-red');
      expect(badge.className).toContain('text-red');
    });

    it('should apply green color variant', () => {
      render(<Badge color="green">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge.className).toContain('bg-green');
      expect(badge.className).toContain('text-green');
    });

    it('should apply blue color variant', () => {
      render(<Badge color="blue">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge.className).toContain('bg-blue');
      expect(badge.className).toContain('text-blue');
    });

    it('should apply amber color variant', () => {
      render(<Badge color="amber">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge.className).toContain('bg-amber');
      expect(badge.className).toContain('text-amber');
    });
  });

  describe('Props Spreading', () => {
    it('should pass through HTML span attributes', () => {
      render(
        <Badge data-testid="my-badge" id="badge-1">
          Test
        </Badge>,
      );
      const badge = screen.getByTestId('my-badge');
      expect(badge).toHaveAttribute('id', 'badge-1');
    });
  });
});

describe('BadgeButton', () => {
  describe('Rendering as button', () => {
    it('should render as a button by default', () => {
      render(<BadgeButton>Click</BadgeButton>);
      expect(screen.getByRole('button', { name: /click/i })).toBeInTheDocument();
    });

    it('should render with badge styling inside', () => {
      render(<BadgeButton color="red">Alert</BadgeButton>);
      expect(screen.getByText('Alert')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should handle click events', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<BadgeButton onClick={onClick}>Clickable</BadgeButton>);
      await user.click(screen.getByRole('button', { name: /clickable/i }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not fire click when disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(
        <BadgeButton disabled onClick={onClick}>
          Disabled
        </BadgeButton>,
      );
      await user.click(screen.getByRole('button', { name: /disabled/i }));

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Color Variants', () => {
    it('should pass color to inner Badge', () => {
      render(<BadgeButton color="purple">Purple</BadgeButton>);
      const badgeSpan = screen.getByText('Purple');
      expect(badgeSpan.className).toContain('bg-purple');
    });
  });
});
