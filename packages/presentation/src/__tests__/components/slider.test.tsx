import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from '../../components/slider.js'

describe('Slider', () => {
  it('renders an input with type range', () => {
    render(<Slider />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('uses defaultValue', () => {
    render(<Slider defaultValue={30} />)
    expect(screen.getByRole('slider')).toHaveValue('30')
  })

  it('calls onChange when value changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Slider defaultValue={0} min={0} max={100} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    // Simulate a range input change via fireEvent (userEvent doesn't handle range well)
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalled()
  })

  it('respects min and max attributes', () => {
    render(<Slider min={10} max={90} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '10')
    expect(slider).toHaveAttribute('max', '90')
  })

  it('is disabled when disabled prop is set', () => {
    render(<Slider disabled />)
    expect(screen.getByRole('slider')).toBeDisabled()
  })

  it('shows label when provided', () => {
    render(<Slider label="Volume" />)
    expect(screen.getByText('Volume')).toBeInTheDocument()
  })

  it('shows current value when showValue is true', () => {
    render(<Slider defaultValue={42} showValue />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
