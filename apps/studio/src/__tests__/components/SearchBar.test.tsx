import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from '../../components/vault/SearchBar';

describe('SearchBar', () => {
  it('renders a search input', () => {
    render(<SearchBar query="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search secrets...')).toBeInTheDocument();
  });

  it('displays the current query value', () => {
    render(<SearchBar query="stripe" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('stripe')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchBar query="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search secrets...'), {
      target: { value: 'neon' },
    });
    expect(onChange).toHaveBeenCalledWith('neon');
  });

  it('has search input type', () => {
    render(<SearchBar query="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Search secrets...');
    expect(input).toHaveAttribute('type', 'search');
  });
});
