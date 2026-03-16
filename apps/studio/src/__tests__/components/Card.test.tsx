import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from '../../components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-neutral-900');
    expect(card.className).toContain('border-neutral-800');
  });

  it('applies elevated variant styles', () => {
    const { container } = render(<Card variant="elevated">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-neutral-700');
    expect(card.className).toContain('shadow-lg');
  });

  it('applies ghost variant styles', () => {
    const { container } = render(<Card variant="ghost">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-transparent');
  });

  it('applies padding styles', () => {
    const { container, rerender } = render(<Card padding="sm">Content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('p-3');

    rerender(<Card padding="lg">Content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('p-6');

    rerender(<Card padding="none">Content</Card>);
    expect((container.firstChild as HTMLElement).className).not.toContain('p-3');
    expect((container.firstChild as HTMLElement).className).not.toContain('p-4');
    expect((container.firstChild as HTMLElement).className).not.toContain('p-6');
  });

  it('renders header when provided', () => {
    render(<Card header={<span>Header Text</span>}>Body</Card>);
    expect(screen.getByText('Header Text')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('does not render header section when header is not provided', () => {
    const { container } = render(<Card>Body only</Card>);
    const headerDivider = container.querySelector('.border-b');
    expect(headerDivider).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="mt-4">Content</Card>);
    expect((container.firstChild as HTMLElement).className).toContain('mt-4');
  });
});
