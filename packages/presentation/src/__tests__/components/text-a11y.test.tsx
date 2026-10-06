import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownText, SkipLink } from '../../components/text.js';

describe('MarkdownText', () => {
  it('renders bold, code, and a labeled link instead of raw markdown', () => {
    render(
      <MarkdownText text="**[GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)**: ask in public. Use `create-revealui`." />,
    );

    const rendered = document.body.textContent ?? '';
    expect(rendered.includes('**')).toBe(false);
    expect(rendered.includes('https://github.com')).toBe(false);
    const link = screen.getByRole('link', { name: 'GitHub Discussions' });
    expect(link).toHaveAttribute('href', 'https://github.com/RevealUIStudio/revealui/discussions');
    expect(screen.getByText('create-revealui').tagName).toBe('CODE');
    expect(link.parentElement?.tagName).toBe('STRONG');
  });

  it('wraps long tokens so a narrow viewport does not grow sideways', () => {
    const { container } = render(
      <MarkdownText text="A verylongtokenwithoutspaces should wrap inside the prose span." />,
    );
    const prose = container.querySelector('[data-slot="markdown-text"]');
    expect(prose?.className).toContain('wrap-anywhere');
    expect(prose?.className).toContain('break-words');
  });

  it('drops javascript URLs instead of linking them', () => {
    render(<MarkdownText text="[click](javascript:alert(1)) stays text" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect((document.body.textContent ?? '').includes('click')).toBe(true);
  });
});

describe('SkipLink', () => {
  it('stacks above a z-50 sticky header when focused', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveAttribute('href', '#main-content');
    expect(link.className).toContain('focus:z-[60]');
    expect(link.className).toContain('sr-only');
    expect(link.className).toContain('focus:not-sr-only');
  });
});
