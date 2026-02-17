import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useClickOutside } from '../../hooks/use-click-outside.js'

function TestComponent({
  onClickOutside,
  enabled = true,
}: {
  onClickOutside: () => void
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClickOutside, enabled)

  return (
    <div>
      <div ref={ref} data-testid="inside">
        Inside
      </div>
      <div data-testid="outside">Outside</div>
    </div>
  )
}

function MultiRefComponent({ onClickOutside }: { onClickOutside: () => void }) {
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  useClickOutside([ref1, ref2], onClickOutside)

  return (
    <div>
      <div ref={ref1} data-testid="inside-1">
        Inside 1
      </div>
      <div ref={ref2} data-testid="inside-2">
        Inside 2
      </div>
      <div data-testid="outside">Outside</div>
    </div>
  )
}

describe('useClickOutside', () => {
  it('should call handler when clicking outside the ref', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()

    render(<TestComponent onClickOutside={handler} />)

    await user.click(screen.getByTestId('outside'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('should not call handler when clicking inside the ref', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()

    render(<TestComponent onClickOutside={handler} />)

    await user.click(screen.getByTestId('inside'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('should not call handler when disabled', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()

    render(<TestComponent onClickOutside={handler} enabled={false} />)

    await user.click(screen.getByTestId('outside'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('should support multiple refs', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()

    render(<MultiRefComponent onClickOutside={handler} />)

    await user.click(screen.getByTestId('inside-1'))
    expect(handler).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('inside-2'))
    expect(handler).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('outside'))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('should clean up listener on unmount', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()

    const { unmount } = render(<TestComponent onClickOutside={handler} />)

    unmount()
    await user.click(document.body)
    expect(handler).not.toHaveBeenCalled()
  })
})
