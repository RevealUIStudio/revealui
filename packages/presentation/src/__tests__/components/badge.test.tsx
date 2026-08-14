/**
 * Badge Component Tests
 *
 * Semantic-intent API (Phase 3 PR-3). Palette `color` remains as a deprecated
 * alias through 0.15 and is covered only as a mapping contract.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge, BadgeButton } from '../../components/badge.js';

describe('Badge', () => {
  describe('Rendering', () => {
    it('renders a span with its text', () => {
      render(<Badge>Active</Badge>);
      const badge = screen.getByText('Active');
      expect(badge.tagName).toBe('SPAN');
    });

    it('applies a custom className after the intent classes', () => {
      render(<Badge className="custom-class">Test</Badge>);
      expect(screen.getByText('Test')).toHaveClass('custom-class');
    });

    it('applies the chip base styles', () => {
      render(<Badge>Base</Badge>);
      const badge = screen.getByText('Base');
      expect(badge).toHaveClass('inline-flex');
      expect(badge).toHaveClass('font-medium');
      expect(badge).toHaveClass('rounded-[var(--rvui-radius-full,9999px)]');
    });
  });

  describe('Intents', () => {
    it('defaults to the neutral (muted) fill', () => {
      render(<Badge>Default</Badge>);
      expect(screen.getByText('Default')).toHaveClass('bg-muted');
      expect(screen.getByText('Default')).toHaveClass('text-muted-foreground');
    });

    it('applies brand', () => {
      render(<Badge intent="brand">Info</Badge>);
      expect(screen.getByText('Info')).toHaveClass('bg-primary/10');
      expect(screen.getByText('Info')).toHaveClass('text-primary');
    });

    it('applies success', () => {
      render(<Badge intent="success">Ok</Badge>);
      expect(screen.getByText('Ok')).toHaveClass('bg-success/10');
      expect(screen.getByText('Ok')).toHaveClass('text-success');
    });

    it('applies warning', () => {
      render(<Badge intent="warning">Hold</Badge>);
      expect(screen.getByText('Hold')).toHaveClass('bg-warning/10');
    });

    it('applies danger', () => {
      render(<Badge intent="danger">Failed</Badge>);
      expect(screen.getByText('Failed')).toHaveClass('bg-destructive/10');
      expect(screen.getByText('Failed')).toHaveClass('text-destructive');
    });

    it('does not emit raw Tailwind palette steps', () => {
      render(<Badge intent="danger">Failed</Badge>);
      expect(screen.getByText('Failed').className).not.toMatch(
        /\b(?:red|green|blue|amber|zinc|purple)-\d{2,3}\b/,
      );
    });
  });

  describe('Deprecated color alias', () => {
    it('maps palette red to danger', () => {
      render(<Badge color="red">Error</Badge>);
      expect(screen.getByText('Error')).toHaveClass('bg-destructive/10');
    });

    it('maps palette green to success', () => {
      render(<Badge color="green">Saved</Badge>);
      expect(screen.getByText('Saved')).toHaveClass('bg-success/10');
    });

    it('maps palette blue to brand', () => {
      render(<Badge color="blue">Info</Badge>);
      expect(screen.getByText('Info')).toHaveClass('bg-primary/10');
    });

    it('accepts an already-semantic color name as a migration shim', () => {
      render(<Badge color="muted">Tag</Badge>);
      expect(screen.getByText('Tag')).toHaveClass('bg-muted');
    });

    it('does not leak the color prop onto the DOM', () => {
      render(<Badge color="red">Error</Badge>);
      expect(screen.getByText('Error')).not.toHaveAttribute('color');
    });
  });

  describe('Props spreading', () => {
    it('passes through HTML span attributes', () => {
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
    it('renders a button by default', () => {
      render(<BadgeButton>Click</BadgeButton>);
      expect(screen.getByRole('button', { name: /click/i })).toBeInTheDocument();
    });

    it('forwards intent to the inner Badge', () => {
      render(<BadgeButton intent="danger">Alert</BadgeButton>);
      expect(screen.getByText('Alert')).toHaveClass('bg-destructive/10');
    });

    it('uses the native focus-visible ring, not data-focus', () => {
      render(<BadgeButton>Focus</BadgeButton>);
      expect(screen.getByRole('button')).toHaveClass('focus-visible:outline-ring');
      expect(screen.getByRole('button').className).not.toContain('data-focus:outline');
    });
  });

  describe('User interaction', () => {
    it('fires onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      render(<BadgeButton onClick={onClick}>Clickable</BadgeButton>);
      await user.click(screen.getByRole('button', { name: /clickable/i }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire onClick when disabled', async () => {
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
});
