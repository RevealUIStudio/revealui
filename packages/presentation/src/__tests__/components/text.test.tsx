/**
 * Text Component Tests
 *
 * Tests for the Text, TextLink, Strong, and Code components
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Code, Strong, Text, TextLink } from '../../components/text.js';

describe('Text', () => {
  it('should render a p element', () => {
    render(<Text>Paragraph text</Text>);

    const p = screen.getByText('Paragraph text');
    expect(p).toBeInTheDocument();
    expect(p.tagName).toBe('P');
  });

  it('should have data-slot attribute', () => {
    render(<Text>Slotted</Text>);

    const p = screen.getByText('Slotted');
    expect(p).toHaveAttribute('data-slot', 'text');
  });

  it('should apply custom className', () => {
    render(<Text className="custom-text">Styled</Text>);

    const p = screen.getByText('Styled');
    expect(p).toHaveClass('custom-text');
  });
});

describe('TextLink', () => {
  it('should render a link with href', () => {
    render(<TextLink href="/about">About</TextLink>);

    const link = screen.getByRole('link', { name: 'About' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/about');
  });

  it('should apply custom className', () => {
    render(
      <TextLink href="/test" className="custom-link">
        Link
      </TextLink>,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveClass('custom-link');
  });

  it('should render children content', () => {
    render(<TextLink href="/docs">Documentation</TextLink>);

    expect(screen.getByText('Documentation')).toBeInTheDocument();
  });
});

describe('Strong', () => {
  it('should render a strong element', () => {
    render(<Strong>Bold text</Strong>);

    const strong = screen.getByText('Bold text');
    expect(strong).toBeInTheDocument();
    expect(strong.tagName).toBe('STRONG');
  });

  it('should apply custom className', () => {
    render(<Strong className="custom-strong">Styled bold</Strong>);

    const strong = screen.getByText('Styled bold');
    expect(strong).toHaveClass('custom-strong');
  });
});

describe('Code', () => {
  it('should render a code element', () => {
    render(<Code>const x = 1</Code>);

    const code = screen.getByText('const x = 1');
    expect(code).toBeInTheDocument();
    expect(code.tagName).toBe('CODE');
  });

  it('should apply custom className', () => {
    render(<Code className="custom-code">snippet</Code>);

    const code = screen.getByText('snippet');
    expect(code).toHaveClass('custom-code');
  });
});
