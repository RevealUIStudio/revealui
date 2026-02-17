import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from '../../hooks/use-focus-trap.js'

function TrapContainer({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, enabled)

  return (
    <div ref={ref} data-testid="trap">
      <button type="button">First</button>
      <button type="button">Second</button>
      <button type="button">Third</button>
    </div>
  )
}

function EmptyTrapContainer() {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true)
  return (
    <div ref={ref} data-testid="trap">
      No focusable elements
    </div>
  )
}

describe('useFocusTrap', () => {
  it('should focus first focusable element on mount', () => {
    render(<TrapContainer />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('should wrap focus from last to first on Tab', async () => {
    const user = userEvent.setup()
    render(<TrapContainer />)

    // Focus starts on First
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Third' })).toHaveFocus()

    // Tab from last should wrap to first
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('should wrap focus from first to last on Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<TrapContainer />)

    // Focus starts on First, Shift+Tab should go to last
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Third' })).toHaveFocus()
  })

  it('should not trap focus when disabled', () => {
    render(<TrapContainer enabled={false} />)
    // First button should NOT have automatic focus
    expect(screen.getByRole('button', { name: 'First' })).not.toHaveFocus()
  })

  it('should restore focus to previously focused element on unmount', () => {
    // Create an element outside the trap to receive initial focus
    const outerButton = document.createElement('button')
    outerButton.textContent = 'Outer'
    document.body.appendChild(outerButton)
    outerButton.focus()

    expect(outerButton).toHaveFocus()

    const { unmount } = render(<TrapContainer />)
    // Focus moved into trap
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    unmount()
    // Focus should be restored to outer button
    expect(outerButton).toHaveFocus()

    document.body.removeChild(outerButton)
  })

  it('should handle container with no focusable elements', () => {
    render(<EmptyTrapContainer />)
    const trap = screen.getByTestId('trap')
    expect(trap).toHaveFocus()
    expect(trap).toHaveAttribute('tabindex', '-1')
  })
})
