import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RevealUIWordmark } from '../../components/wordmark.js';

describe('RevealUIWordmark', () => {
  it('renders the monogram as a decorative SVG', () => {
    const { container } = render(<RevealUIWordmark />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders "Reveal" and "UI" as separate, readable HTML text nodes', () => {
    const { container, getByText } = render(<RevealUIWordmark />);
    expect(getByText('Reveal')).toBeInTheDocument();
    expect(getByText('UI')).toBeInTheDocument();
    // The wordmark is real HTML, not SVG <text> — no <text> element should be present.
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

  it('renders the Solar Amber outline stroke by default', () => {
    const { container } = render(<RevealUIWordmark />);
    const strokedGroup = container.querySelector('g[stroke]');
    expect(strokedGroup).not.toHaveAttribute('stroke', 'none');
  });

  it('omits the outline stroke when reveal is false', () => {
    const { container } = render(<RevealUIWordmark reveal={false} />);
    const strokedGroup = container.querySelector('g[stroke]');
    expect(strokedGroup).toHaveAttribute('stroke', 'none');
  });

  it('merges a custom className onto the outer wrapper', () => {
    const { container } = render(<RevealUIWordmark className="text-4xl" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute('class')).toContain('text-4xl');
  });
});
