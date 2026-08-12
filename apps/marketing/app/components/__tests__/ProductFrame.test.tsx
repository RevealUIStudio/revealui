import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductFrame } from '../landing/ProductFrame';

describe('ProductFrame', () => {
  it('renders live presentation primitives inside admin chrome', () => {
    render(
      <ProductFrame
        caption={{
          prefix: 'Local screenshot from a fresh',
          code: 'npx create-revealui',
          suffix: '. The three beats below describe the steps.',
        }}
      />,
    );

    expect(screen.getByRole('img', { name: /RevealUI admin shell/i })).toBeTruthy();
    expect(screen.getByText(/support-agent · refund flow/i)).toBeTruthy();
    expect(screen.getByLabelText(/Agent online/i)).toBeTruthy();
    expect(screen.getByLabelText(/Approved/i)).toBeTruthy();
    expect(screen.getByText(/npx create-revealui/)).toBeTruthy();
    expect(screen.getByText(/Live presentation components/i)).toBeTruthy();
  });

  it('lists the five primitives in the sidebar chrome', () => {
    const { container } = render(<ProductFrame />);
    for (const label of ['People', 'Content', 'Offers', 'Payments', 'Agents']) {
      expect(container.textContent).toContain(label);
    }
  });
});
