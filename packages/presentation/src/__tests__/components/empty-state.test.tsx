import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from '../../components/empty-state.js'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No results found" />)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try adjusting your filters." />)
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument()
  })

  it('renders action node when provided', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <EmptyState
        title="Empty"
        action={
          <button type="button" onClick={onClick}>
            Create new
          </button>
        }
      />,
    )
    const btn = screen.getByRole('button', { name: 'Create new' })
    await user.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders without optional props', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})
