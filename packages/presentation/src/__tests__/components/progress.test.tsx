import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Progress } from '../../components/progress.js'

describe('Progress', () => {
  it('renders a progressbar', () => {
    render(<Progress value={50} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('sets aria-valuenow, aria-valuemin, aria-valuemax', () => {
    render(<Progress value={30} max={200} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '200')
  })

  it('shows label when provided', () => {
    render(<Progress value={75} label="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows percentage value when showValue is true', () => {
    render(<Progress value={40} showValue />)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('clamps value above max to 100%', () => {
    render(<Progress value={150} max={100} showValue />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps negative value to 0%', () => {
    render(<Progress value={-10} showValue />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
