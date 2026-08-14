import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChoiceCard } from '../../components/choice-card.js';

describe('ChoiceCard', () => {
  it('renders a wrapping button with title and description', () => {
    render(
      <ChoiceCard title="Content Writer" description="Creates blog posts and landing pages." />,
    );

    const card = screen.getByRole('button', { name: /Content Writer/ });
    expect(card.className.includes('whitespace-normal')).toBe(true);
    expect(card.className.includes('whitespace-nowrap')).toBe(false);
    expect(screen.getByText('Creates blog posts and landing pages.')).toBeInTheDocument();
  });

  it('marks the selected card as pressed', () => {
    render(<ChoiceCard title="Support Agent" selected />);
    expect(screen.getByRole('button', { name: 'Support Agent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
