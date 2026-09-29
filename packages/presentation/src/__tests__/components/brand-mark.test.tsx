import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RevealUIMark } from '../../components/brand-mark.js';

describe('RevealUIMark', () => {
  it('references the kit master asset and does not inline path data', () => {
    const { container } = render(<RevealUIMark title="RevealUI" />);
    const light = container.querySelector('img[data-circuit-r="light"]');
    const dark = container.querySelector('img[data-circuit-r="dark"]');
    expect(light).toHaveAttribute('src', '/revealui-logo.svg');
    expect(dark).toHaveAttribute('src', '/revealui-logo-dark.svg');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('path')).toBeNull();
    expect(container.innerHTML.includes('M172,150')).toBe(false);
    expect(container.innerHTML.includes('M219.6,335.1')).toBe(false);
    expect(container.innerHTML.includes('M26 50')).toBe(false);
    expect(container.innerHTML.includes('invert')).toBe(false);
  });

  it('uses the same master when reveal is false', () => {
    const { container } = render(<RevealUIMark reveal={false} title="RevealUI" />);
    expect(container.querySelector('img[src="/revealui-logo.svg"]')).toBeTruthy();
    expect(container.querySelector('img[src="/revealui-logo-dark.svg"]')).toBeTruthy();
    expect(container.querySelector('path')).toBeNull();
    expect(container.innerHTML.includes('invert')).toBe(false);
  });

  it('is decorative when no title is passed', () => {
    const { container } = render(<RevealUIMark />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it('names the mark when a title is passed', () => {
    const { container } = render(<RevealUIMark title="RevealUI" />);
    const mark = container.querySelector('[role="img"]');
    expect(mark).toHaveAttribute('aria-label', 'RevealUI');
  });
});
