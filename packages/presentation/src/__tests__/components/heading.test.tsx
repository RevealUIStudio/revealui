/**
 * Heading Component Tests
 *
 * Tests for the Heading and Subheading components
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Heading, Subheading } from '../../components/heading.js';

describe('Heading', () => {
  it('should render an h1 by default', () => {
    render(<Heading>Title</Heading>);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Title');
  });

  it('should render the correct heading level', () => {
    const { rerender } = render(<Heading level={2}>Level 2</Heading>);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

    rerender(<Heading level={3}>Level 3</Heading>);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();

    rerender(<Heading level={6}>Level 6</Heading>);
    expect(screen.getByRole('heading', { level: 6 })).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(<Heading>Hello World</Heading>);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Heading className="custom-heading">Styled</Heading>);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('custom-heading');
  });

  it('should have base font styling', () => {
    render(<Heading>Styled Heading</Heading>);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('font-semibold');
  });
});

describe('Subheading', () => {
  it('should render an h2 by default', () => {
    render(<Subheading>Subtitle</Subheading>);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Subtitle');
  });

  it('should render the correct heading level', () => {
    render(<Subheading level={3}>Level 3 Sub</Subheading>);

    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(<Subheading>Sub Content</Subheading>);

    expect(screen.getByText('Sub Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Subheading className="custom-sub">Styled Sub</Subheading>);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveClass('custom-sub');
  });
});
