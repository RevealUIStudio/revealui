import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductFrame } from '../landing/ProductFrame';

describe('ProductFrame', () => {
  it('renders agents-as-users chrome without replaying the hero refund receipt', () => {
    render(
      <ProductFrame
        caption={{
          prefix: 'Live admin chrome composed from',
          code: '@revealui/presentation',
          suffix: 'components. The three beats are the local install path.',
        }}
      />,
    );

    expect(screen.getByRole('figure', { name: /RevealUI admin shell/i })).toBeTruthy();
    expect(screen.getByText(/Agents on the same roles and policies as people/i)).toBeTruthy();
    expect(screen.getByText('support-agent')).toBeTruthy();
    expect(screen.getByText('billing-agent')).toBeTruthy();
    expect(screen.queryByText(/refund flow/i)).toBeNull();
    expect(screen.queryByText(/Live audit trail/i)).toBeNull();
    expect(screen.getByLabelText(/Approved/i)).toBeTruthy();
    expect(screen.getByText(/@revealui\/presentation/)).toBeTruthy();
    expect(screen.getByText(/Live presentation components/i)).toBeTruthy();
  });

  it('lists the five primitives in the sidebar chrome', () => {
    const { container } = render(<ProductFrame />);
    for (const label of ['People', 'Content', 'Offers', 'Payments', 'Agents']) {
      expect(container.textContent).toContain(label);
    }
  });
});
