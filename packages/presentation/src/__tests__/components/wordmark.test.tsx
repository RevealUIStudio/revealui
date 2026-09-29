import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RevealUIWordmark } from '../../components/wordmark.js';

describe('RevealUIWordmark', () => {
  it('renders the monogram as a decorative master asset', () => {
    const { container } = render(<RevealUIWordmark />);
    const mark = container.querySelector('[aria-hidden="true"]');
    expect(mark).toBeInTheDocument();
    expect(container.querySelector('img[src="/revealui-logo.svg"]')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('does not inline Circuit-R path data', () => {
    const { container } = render(<RevealUIWordmark />);
    expect(container.innerHTML.includes('M26 50')).toBe(false);
    expect(container.innerHTML.includes('M242,150')).toBe(false);
    expect(container.querySelector('path')).toBeNull();
  });

  it('renders "Reveal" and "UI" as separate, readable HTML text nodes', () => {
    const { container, getByText } = render(<RevealUIWordmark />);
    expect(getByText('Reveal')).toBeInTheDocument();
    expect(getByText('UI')).toBeInTheDocument();
    // The wordmark is real HTML, not SVG <text>. No <text> element should be present.
    expect(container.querySelector('text')).toBeNull();
  });

  it('uses the brand display font stack, not Space Grotesk', () => {
    const { getByText } = render(<RevealUIWordmark />);
    const textWrapper = getByText('Reveal').parentElement;
    expect(textWrapper?.style.fontFamily).toContain('Inter Tight');
    expect(textWrapper?.style.fontFamily).not.toContain('Space Grotesk');
  });

  it('colors "Reveal" with the brand-text token and "UI" with the accent token', () => {
    const { getByText } = render(<RevealUIWordmark />);
    expect(getByText('Reveal').style.color).toContain('--rvui-brand-text');
    expect(getByText('UI').style.color).toContain('--rvui-accent');
  });

  it('keeps the same master asset when reveal is false', () => {
    const { container } = render(<RevealUIWordmark reveal={false} />);
    expect(container.querySelector('img[src="/revealui-logo.svg"]')).toBeTruthy();
    expect(container.querySelector('img[src="/revealui-logo-dark.svg"]')).toBeTruthy();
    expect(container.querySelector('path')).toBeNull();
    expect(container.innerHTML.includes('invert')).toBe(false);
  });

  it('merges a custom className onto the outer wrapper', () => {
    const { container } = render(<RevealUIWordmark className="text-4xl" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute('class')).toContain('text-4xl');
  });
});
