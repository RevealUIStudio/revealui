/**
 * MarketingSection + SectionHeader — public marketing shell primitives.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketingSection, SectionHeader } from '../../components/marketing-section.js';

describe('MarketingSection', () => {
  it('renders children in a section with data-slot', () => {
    render(
      <MarketingSection>
        <p>Inside</p>
      </MarketingSection>,
    );
    const section = screen.getByText('Inside').closest('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('data-slot', 'marketing-section');
    expect(section).toHaveAttribute('data-tone', 'background');
    expect(section).toHaveAttribute('data-density', 'default');
    expect(section).toHaveAttribute('data-width', 'default');
  });

  it('applies tone, density, and width classes', () => {
    render(
      <MarketingSection tone="secondary" density="compact" width="narrow">
        <span>Child</span>
      </MarketingSection>,
    );
    const section = screen.getByText('Child').closest('section');
    expect(section).toHaveClass('bg-secondary');
    expect(section).toHaveClass('py-16');
    expect(section).toHaveAttribute('data-tone', 'secondary');
    expect(section).toHaveAttribute('data-density', 'compact');
    expect(section).toHaveAttribute('data-width', 'narrow');
    const inner = section?.firstElementChild;
    expect(inner).toHaveClass('max-w-3xl');
  });

  it('omits horizontal padding when bleed is true', () => {
    render(
      <MarketingSection bleed>
        <span>Bleed</span>
      </MarketingSection>,
    );
    const section = screen.getByText('Bleed').closest('section');
    expect(section?.className).not.toMatch(/\bpx-6\b/);
  });

  it('merges className onto the section', () => {
    render(
      <MarketingSection className="isolate overflow-hidden">
        <span>X</span>
      </MarketingSection>,
    );
    const section = screen.getByText('X').closest('section');
    expect(section).toHaveClass('isolate');
    expect(section).toHaveClass('overflow-hidden');
  });
});

describe('SectionHeader', () => {
  it('renders title as h2 by default with body description', () => {
    render(
      <SectionHeader eyebrow="Eyebrow" title="Heading" description="Body copy for reading." />,
    );
    const title = screen.getByRole('heading', { level: 2, name: 'Heading' });
    expect(title).toHaveClass('text-foreground');
    expect(screen.getByText('Eyebrow')).toHaveClass('tracking-widest');
    const description = screen.getByText('Body copy for reading.');
    expect(description).toHaveClass('text-body');
    expect(description).not.toHaveClass('text-muted-foreground');
  });

  it('supports muted eyebrow and h1 title', () => {
    render(
      <SectionHeader eyebrow="Quiet" eyebrowTone="muted" title="Hero" titleAs="h1" align="start" />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Hero' })).toBeInTheDocument();
    expect(screen.getByText('Quiet')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Quiet').parentElement).toHaveClass('text-left');
  });

  it('omits empty optional slots', () => {
    render(<SectionHeader title="Only title" />);
    expect(screen.queryByText('Only title')).toBeInTheDocument();
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });
});
