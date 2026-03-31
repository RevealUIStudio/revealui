import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IconCheck,
  IconChevronDown,
  IconClose,
  IconCopy,
  IconEdit,
  IconLoading,
  IconMoon,
  IconSearch,
  IconStar,
  IconSun,
  IconUser,
} from '../../components/icon.js';

describe('Icon components', () => {
  describe('IconBase behavior', () => {
    it('renders as decorative by default (no label)', () => {
      const { container } = render(<IconChevronDown />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).not.toHaveAttribute('role');
    });

    it('renders as accessible image with label', () => {
      render(<IconSearch label="Search" />);
      const svg = screen.getByRole('img', { name: 'Search' });
      expect(svg).toBeInTheDocument();
      expect(svg).not.toHaveAttribute('aria-hidden');
      expect(svg).toHaveAttribute('aria-label', 'Search');
    });

    it('includes title element when label is provided', () => {
      const { container } = render(<IconStar label="Favorite" />);
      const title = container.querySelector('title');
      expect(title).toHaveTextContent('Favorite');
    });

    it('omits title element when no label', () => {
      const { container } = render(<IconStar />);
      const title = container.querySelector('title');
      expect(title).toBeNull();
    });

    it('uses default md size', () => {
      const { container } = render(<IconUser />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('size-5');
    });

    it('applies size xs', () => {
      const { container } = render(<IconUser size="xs" />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('size-3');
    });

    it('applies size sm', () => {
      const { container } = render(<IconUser size="sm" />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('size-4');
    });

    it('applies size lg', () => {
      const { container } = render(<IconUser size="lg" />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('size-6');
    });

    it('applies size xl', () => {
      const { container } = render(<IconUser size="xl" />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('size-8');
    });

    it('merges custom className', () => {
      const { container } = render(<IconCheck className="text-green-500" />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('text-green-500');
      expect(svg?.getAttribute('class')).toContain('shrink-0');
    });

    it('uses 24x24 viewBox', () => {
      const { container } = render(<IconClose />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('uses stroke rendering', () => {
      const { container } = render(<IconEdit />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('passes through SVG props', () => {
      const { container } = render(<IconCopy data-testid="icon" style={{ opacity: 0.5 }} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('data-testid', 'icon');
      expect(svg?.style.opacity).toBe('0.5');
    });
  });

  describe('specific icons render paths', () => {
    it('IconChevronDown renders a path', () => {
      const { container } = render(<IconChevronDown />);
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('IconSun renders circle and lines', () => {
      const { container } = render(<IconSun />);
      // Sun has circle + multiple lines
      expect(container.querySelectorAll('circle, line, path').length).toBeGreaterThan(0);
    });

    it('IconMoon renders a path', () => {
      const { container } = render(<IconMoon />);
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('IconLoading has animate-spin class', () => {
      const { container } = render(<IconLoading />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('animate-spin');
    });
  });
});
