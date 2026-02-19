import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Rating } from '../../components/rating.js'

describe('Rating', () => {
  it('renders the correct number of stars', () => {
    render(<Rating max={5} />)
    // Each star is a button or radio
    const stars = screen.getAllByRole('radio')
    expect(stars).toHaveLength(5)
  })

  it('renders custom max stars', () => {
    render(<Rating max={3} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('calls onChange when a star is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Rating max={5} onChange={onChange} />)
    const stars = screen.getAllByRole('radio')
    await user.click(stars[2]) // click 3rd star
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('does not call onChange in readOnly mode', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Rating max={5} onChange={onChange} readOnly />)
    const stars = screen.getAllByRole('img')
    await user.click(stars[0])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows label when provided', () => {
    render(<Rating label="Your rating" />)
    expect(screen.getByText('Your rating')).toBeInTheDocument()
  })
})
