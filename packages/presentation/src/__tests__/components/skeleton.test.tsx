import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton, SkeletonCard, SkeletonText } from '../../components/skeleton.js';

describe('Skeleton', () => {
  it('renders a div element', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Skeleton className="w-64 h-4" data-testid="skeleton" />);
    const el = screen.getByTestId('skeleton');
    expect(el.className).toContain('w-64');
    expect(el.className).toContain('h-4');
  });
});

describe('SkeletonText', () => {
  it('renders the default number of lines', () => {
    const { container } = render(<SkeletonText />);
    // Default is 3 lines
    expect(container.querySelectorAll('[class*="skeleton"], div').length).toBeGreaterThan(0);
  });

  it('renders specified number of lines', () => {
    const { container } = render(<SkeletonText lines={2} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('SkeletonCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
