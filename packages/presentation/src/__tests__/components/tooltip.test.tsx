import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows tooltip after hover', () => {
      render(
        <Tooltip content="Tip text">
          <button type="button">Hover me</button>
        </Tooltip>,
      )
      const trigger = screen.getByText('Hover me').closest('span') as HTMLElement
      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Tip text')).toBeInTheDocument()
    })

    it('hides tooltip after mouse leaves', () => {
      render(
        <Tooltip content="Tip text">
          <button type="button">Hover me</button>
        </Tooltip>,
      )
      const trigger = screen.getByText('Hover me').closest('span') as HTMLElement
      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      fireEvent.mouseLeave(trigger)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('renders tooltip content from prop', () => {
      render(
        <Tooltip content={<strong>Rich content</strong>}>
          <span>Target</span>
        </Tooltip>,
      )
      const trigger = screen.getByText('Target').closest('span') as HTMLElement
      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByText('Rich content')).toBeInTheDocument()
    })
  })
})
