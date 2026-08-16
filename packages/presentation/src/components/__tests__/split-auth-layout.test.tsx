import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplitAuthLayout } from '../split-auth-layout.js';

describe('SplitAuthLayout', () => {
  it('locks the brand column to the dark token ladder on surface-0', () => {
    const { container } = render(
      <SplitAuthLayout brand={<span>brand</span>} brandSurface="surface-0">
        <p>form</p>
      </SplitAuthLayout>,
    );
    const aside = container.querySelector('aside');
    expect(aside?.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByText('brand')).toBeTruthy();
    expect(screen.getByText('form')).toBeTruthy();
  });
});
