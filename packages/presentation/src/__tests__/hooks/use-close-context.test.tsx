import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CloseContext, useCloseContext } from '../../hooks/use-close-context.js'

function CloseButton() {
  const close = useCloseContext()
  return (
    <button type="button" onClick={() => close?.()}>
      Close
    </button>
  )
}

describe('useCloseContext', () => {
  it('should return null when outside provider', () => {
    const { result } = (() => {
      let value: (() => void) | null = null
      function Capture() {
        value = useCloseContext()
        return null
      }
      render(<Capture />)
      return { result: { current: value } }
    })()

    expect(result.current).toBeNull()
  })

  it('should return the close function from provider', async () => {
    const closeFn = vi.fn()
    const user = userEvent.setup()

    render(
      <CloseContext value={closeFn}>
        <CloseButton />
      </CloseContext>,
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(closeFn).toHaveBeenCalledOnce()
  })
})
