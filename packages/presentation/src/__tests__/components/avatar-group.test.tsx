import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvatarGroup } from '../../components/avatar-group.js'

const items = [
  { src: 'https://example.com/a.jpg', alt: 'Alice', initials: 'AL' },
  { src: 'https://example.com/b.jpg', alt: 'Bob', initials: 'BO' },
  { src: 'https://example.com/c.jpg', alt: 'Carol', initials: 'CA' },
]

describe('AvatarGroup', () => {
  it('renders without crashing', () => {
    const { container } = render(<AvatarGroup items={items} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('shows overflow count when items exceed max', () => {
    render(<AvatarGroup items={items} max={2} />)
    // Should show "+1" overflow indicator
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('does not show overflow count when all items fit', () => {
    render(<AvatarGroup items={items} max={5} />)
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })
})
