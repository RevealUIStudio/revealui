/**
 * Tests for LoadingSkeleton and LoadingSpinner components
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSkeleton, LoadingSpinner } from '../../app/components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('should render without crashing', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render title skeleton placeholder', () => {
    const { container } = render(<LoadingSkeleton />);
    // Title skeleton has w-[55%] class
    const titleSkeleton = container.querySelector('.w-\\[55\\%\\]');
    expect(titleSkeleton).toBeInTheDocument();
  });

  it('should render three paragraph skeleton blocks', () => {
    const { container } = render(<LoadingSkeleton />);
    // Each paragraph block has animate-pulse elements
    const pulseElements = container.querySelectorAll('.animate-pulse');
    // Title (1) + 3 paragraphs x 2 lines each (6) + code block (1) = 8
    expect(pulseElements.length).toBe(8);
  });

  it('should render a code block skeleton', () => {
    const { container } = render(<LoadingSkeleton />);
    const codeBlock = container.querySelector('.bg-code-bg');
    expect(codeBlock).toBeInTheDocument();
  });
});

describe('LoadingSpinner', () => {
  it('should render without crashing', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render a spinning indicator', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
