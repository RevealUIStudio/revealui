import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RevealUIMark } from '../../components/brand-mark.js';

describe('RevealUIMark', () => {
  it('renders the Circuit-R family mark, not the retired geometric R', () => {
    const { container } = render(<RevealUIMark title="RevealUI" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 512 512');
    expect(container.innerHTML.includes('M26 50')).toBe(false);
    expect(container.innerHTML.includes('M34 11')).toBe(false);
    expect(container.innerHTML.includes('M242,150')).toBe(true);
    expect(container.innerHTML.includes('M172,150')).toBe(true);
    expect(container.innerHTML.includes('M219.6,335.1')).toBe(true);
    expect(container.innerHTML.includes('488.0,484.0')).toBe(true);
    expect(container.innerHTML.includes('translate(-300,-320)')).toBe(true);
    expect(container.innerHTML.includes('translate(-330,-320)')).toBe(false);
    expect(container.innerHTML.includes('translate(-290,-320)')).toBe(false);
  });

  it('keeps the Solar Amber reveal stroke by default', () => {
    const { container } = render(<RevealUIMark title="RevealUI" />);
    const strokedGroup = container.querySelector('g[stroke]');
    expect(strokedGroup).not.toHaveAttribute('stroke', 'none');
  });

  it('omits the outline stroke when reveal is false', () => {
    const { container } = render(<RevealUIMark reveal={false} title="RevealUI" />);
    const strokedGroup = container.querySelector('g[stroke]');
    expect(strokedGroup).toHaveAttribute('stroke', 'none');
  });
});
