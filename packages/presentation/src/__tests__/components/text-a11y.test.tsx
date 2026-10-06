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

  it('normalizes backslash http(s) URLs and marks them external', () => {
    render(
      <MarkdownText text="[host](https:\\host), [docs](https://docs.revealui.com), and [mail](mailto:support@revealui.com)" />,
    );
    const host = screen.getByRole('link', { name: 'host' });
    expect(host).toHaveAttribute('href', 'https://host/');
    expect(host).toHaveAttribute('target', '_blank');
    expect(host).toHaveAttribute('rel', 'noopener noreferrer');
    const docs = screen.getByRole('link', { name: 'docs' });
    expect(docs).toHaveAttribute('href', 'https://docs.revealui.com/');
    const mail = screen.getByRole('link', { name: 'mail' });
    expect(mail).toHaveAttribute('href', 'mailto:support@revealui.com');
    expect(mail.hasAttribute('target')).toBe(false);
    expect(mail.hasAttribute('rel')).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java\rscript:alert(1)',
    'java\u0000script:alert(1)',
    'java\u0001script:alert(1)',
    'javascript&#58;alert(1)',
    'javascript&#x3a;alert(1)',
    'javascript&colon;alert(1)',
    'javascript%3Aalert(1)',
    'java%73cript:alert(1)',
    '%6Aavascript:alert(1)',
    'data:text/html,hi',
    'data:text/html;base64,PHNjcmlwdD4',
    'vbscript:msgbox(1)',
    'VBscript:msgbox(1)',
    'file:///etc/passwd',
    'FILE:///tmp/x',
    '//evil.example/phish',
    '\\\\evil.example\\share',
    '\\javascript:alert(1)',
    'javascript:\\alert(1)',
    'javascript:\\\\alert(1)',
  ])('renders no unsafe link for %j', (href) => {
    const { container } = render(<MarkdownText text={`[label](${href}) stays text`} />);
    expect(container.querySelector('a')).toBeNull();
    const rendered = container.textContent ?? '';
    expect(rendered.includes('label')).toBe(true);
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
