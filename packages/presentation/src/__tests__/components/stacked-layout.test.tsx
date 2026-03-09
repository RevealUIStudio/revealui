/**
 * StackedLayout Component Tests
 *
 * Tests the StackedLayout component which provides a stacked navbar-on-top
 * layout with responsive mobile sidebar support.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StackedLayout } from '../../components/stacked-layout.js'

describe('StackedLayout', () => {
  it('should render children in main', () => {
    render(
      <StackedLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Main content</p>
      </StackedLayout>,
    )
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('Main content')
  })

  it('should render navbar content', () => {
    render(
      <StackedLayout navbar={<div>Navbar content</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </StackedLayout>,
    )
    expect(screen.getByText('Navbar content')).toBeInTheDocument()
  })

  it('should have a header element', () => {
    render(
      <StackedLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </StackedLayout>,
    )
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('should have a main element', () => {
    render(
      <StackedLayout navbar={<div>Nav</div>} sidebar={<div>Side</div>}>
        <p>Content</p>
      </StackedLayout>,
    )
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
