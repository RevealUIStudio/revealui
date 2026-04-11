import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Slider } from '../../components/slider.js';

describe('Slider', () => {
  it('renders an input with type range', () => {
    render(<Slider />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('uses defaultValue', () => {
    render(<Slider defaultValue={30} />);
    expect(screen.getByRole('slider')).toHaveValue('30');
  });

  it('calls onChange when value changes', () => {
    const onChange = vi.fn();
    render(<Slider defaultValue={0} min={0} max={100} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    // jsdom does not fire change events from keyboard on range inputs  -  use fireEvent
    fireEvent.change(slider, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('respects min and max attributes', () => {
    render(<Slider min={10} max={90} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '10');
    expect(slider).toHaveAttribute('max', '90');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Slider disabled />);
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('shows label when provided', () => {
    render(<Slider label="Volume" />);
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('shows current value when showValue is true', () => {
    render(<Slider defaultValue={42} showValue />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
