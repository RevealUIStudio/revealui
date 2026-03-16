import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PanelHeader from '../../components/ui/PanelHeader';

describe('PanelHeader', () => {
  it('renders the title', () => {
    render(<PanelHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders as h1 element', () => {
    render(<PanelHeader title="Dashboard" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });

  it('renders action slot when provided', () => {
    render(<PanelHeader title="Settings" action={<button type="button">Refresh</button>} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('does not render action slot when not provided', () => {
    const { container } = render(<PanelHeader title="Settings" />);
    // Only the h1 should be a child of the flex container
    const flexDiv = container.firstChild;
    expect(flexDiv?.childNodes.length).toBe(1);
  });
});
