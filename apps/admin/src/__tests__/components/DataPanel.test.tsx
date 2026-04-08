/**
 * DataPanel Component Tests
 *
 * Tests for the data display panel component
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataPanel } from '../../lib/components/DataPanel';

describe('DataPanel', () => {
  const mockData = {
    title: 'Test Panel',
    value: 42,
    unit: 'items',
    trend: 5.2,
    status: 'healthy' as const,
  };

  describe('Rendering', () => {
    it('should render with title', () => {
      render(<DataPanel {...mockData} />);

      expect(screen.getByText('Test Panel')).toBeInTheDocument();
    });

    it('should display numeric value', () => {
      render(<DataPanel {...mockData} />);

      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should display unit if provided', () => {
      render(<DataPanel {...mockData} />);

      expect(screen.getByText(/items/i)).toBeInTheDocument();
    });

    it('should display trend when provided', () => {
      render(<DataPanel {...mockData} />);

      expect(screen.getByText('5.2%')).toBeInTheDocument();
    });

    it('should render without trend', () => {
      const { title, value, unit, status } = mockData;
      render(<DataPanel title={title} value={value} unit={unit} status={status} />);

      expect(screen.getByText('Test Panel')).toBeInTheDocument();
      expect(screen.queryByText(/5\.2/)).not.toBeInTheDocument();
    });
  });

  describe('Status Indicators', () => {
    it('should show healthy status', () => {
      render(<DataPanel {...mockData} status="healthy" />);

      const panel = screen.getByText('Test Panel').closest('div');
      expect(panel).toHaveAttribute('data-status', 'healthy');
    });

    it('should show warning status', () => {
      render(<DataPanel {...mockData} status="warning" />);

      const panel = screen.getByText('Test Panel').closest('div');
      expect(panel).toHaveAttribute('data-status', 'warning');
    });

    it('should show critical status', () => {
      render(<DataPanel {...mockData} status="critical" />);

      const panel = screen.getByText('Test Panel').closest('div');
      expect(panel).toHaveAttribute('data-status', 'critical');
    });

    it('should apply appropriate color for healthy status', () => {
      const { container } = render(<DataPanel {...mockData} status="healthy" />);

      const statusElement = container.querySelector('[data-status="healthy"]');
      expect(statusElement).toBeTruthy();
    });

    it('should apply appropriate color for warning status', () => {
      const { container } = render(<DataPanel {...mockData} status="warning" />);

      const statusElement = container.querySelector('[data-status="warning"]');
      expect(statusElement).toBeTruthy();
    });

    it('should apply appropriate color for critical status', () => {
      const { container } = render(<DataPanel {...mockData} status="critical" />);

      const statusElement = container.querySelector('[data-status="critical"]');
      expect(statusElement).toBeTruthy();
    });
  });

  describe('Trend Display', () => {
    it('should show positive trend with up indicator', () => {
      render(<DataPanel {...mockData} trend={5.2} />);

      const trendText = screen.getByText('5.2%');
      expect(trendText).toBeInTheDocument();
    });

    it('should show negative trend with down indicator', () => {
      render(<DataPanel {...mockData} trend={-3.1} />);

      const trendText = screen.getByText('3.1%');
      expect(trendText).toBeInTheDocument();
    });

    it('should show zero trend', () => {
      render(<DataPanel {...mockData} trend={0} />);

      const trendText = screen.getByText(/0/);
      expect(trendText).toBeInTheDocument();
    });

    it('should format trend to 1 decimal place', () => {
      render(<DataPanel {...mockData} trend={5.23456} />);

      // Should round to 5.2
      expect(screen.getByText('5.2%')).toBeInTheDocument();
    });
  });

  describe('Value Formatting', () => {
    it('should format large numbers with commas', () => {
      render(<DataPanel {...mockData} value={1000000} />);

      expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
    });

    it('should handle decimal values', () => {
      render(<DataPanel {...mockData} value={42.5} />);

      expect(screen.getByText(/42\.5/)).toBeInTheDocument();
    });

    it('should handle zero value', () => {
      render(<DataPanel {...mockData} value={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle negative values', () => {
      render(<DataPanel {...mockData} value={-10} />);

      expect(screen.getByText(/-10/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      render(<DataPanel {...mockData} loading={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should hide value when loading', () => {
      render(<DataPanel {...mockData} loading={true} />);

      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });

    it('should not show loading indicator by default', () => {
      const { container } = render(<DataPanel {...mockData} />);

      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when provided', () => {
      render(<DataPanel {...mockData} error="Failed to load data" />);

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('should hide value when error is present', () => {
      render(<DataPanel {...mockData} error="Error" />);

      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });

    it('should show error icon', () => {
      render(<DataPanel {...mockData} error="Error" />);

      const errorIcon = screen.getByRole('img', { name: /error/i });
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn();

      render(<DataPanel {...mockData} onClick={handleClick} />);

      const panel = screen.getByText('Test Panel').closest('div');
      if (panel) {
        await panel.click();
        expect(handleClick).toHaveBeenCalledOnce();
      }
    });

    it('should not be clickable without onClick prop', () => {
      const { container } = render(<DataPanel {...mockData} />);

      const panel = container.querySelector('[role="button"]');
      expect(panel).not.toBeInTheDocument();
    });

    it('should have hover state when clickable', () => {
      render(<DataPanel {...mockData} onClick={vi.fn()} />);

      const panel = screen.getByText('Test Panel').closest('div');
      expect(panel).toHaveClass(/cursor-pointer|clickable/);
    });
  });

  describe('Accessibility', () => {
    it('should have descriptive label', () => {
      render(<DataPanel {...mockData} />);

      const panel = screen.getByText('Test Panel');
      expect(panel).toBeTruthy();
    });

    it('should announce status to screen readers', () => {
      render(<DataPanel {...mockData} status="warning" />);

      const statusElements = screen.getAllByRole('status');
      expect(statusElements.some((el) => /warning/i.test(el.textContent ?? ''))).toBe(true);
    });

    it('should be keyboard accessible when clickable', () => {
      render(<DataPanel {...mockData} onClick={vi.fn()} />);

      const panel = screen.getByText('Test Panel').closest('div');
      expect(panel).toHaveAttribute('tabindex', '0');
    });

    it('should have aria-label for trend direction', () => {
      render(<DataPanel {...mockData} trend={5.2} />);

      const trend = screen.getByLabelText(/trending up|increase/i);
      expect(trend).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<DataPanel {...mockData} className="custom-panel" />);

      expect(container.firstChild).toHaveClass('custom-panel');
    });

    it('should support custom styles', () => {
      const { container } = render(<DataPanel {...mockData} style={{ backgroundColor: 'red' }} />);

      expect((container.firstChild as HTMLElement).style.backgroundColor).toBe('red');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(100);

      render(<DataPanel {...mockData} title={longTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      render(<DataPanel {...mockData} value={Number.MAX_SAFE_INTEGER} />);

      expect(screen.getByText(/9,007,199,254,740,991/)).toBeInTheDocument();
    });

    it('should handle Infinity value', () => {
      render(<DataPanel {...mockData} value={Infinity} />);

      expect(screen.getByText(/infinity/i)).toBeInTheDocument();
    });

    it('should handle NaN value', () => {
      render(<DataPanel {...mockData} value={NaN} />);

      expect(screen.getByText(/invalid|error/i)).toBeInTheDocument();
    });
  });
});
