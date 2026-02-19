import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tooltip } from '../../components/tooltip.js'

describe('Tooltip', () => {
  it('does not show tooltip content initially', () => {
    render(
      <Tooltip content="Tip text">
        <button type="button">Hover me</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip after hover', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(
      <Tooltip content="Tip text">
        <button type="button">Hover me</button>
      </Tooltip>,
    )
    await user.hover(screen.getByText('Hover me'))
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText('Tip text')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('hides tooltip after mouse leaves', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(
      <Tooltip content="Tip text">
        <button type="button">Hover me</button>
      </Tooltip>,
    )
    const trigger = screen.getByText('Hover me')
    await user.hover(trigger)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.unhover(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders tooltip content from prop', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(
      <Tooltip content={<strong>Rich content</strong>}>
        <span>Target</span>
      </Tooltip>,
    )
    await user.hover(screen.getByText('Target'))
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByText('Rich content')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
