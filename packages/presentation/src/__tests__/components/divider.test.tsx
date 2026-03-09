/**
 * Divider Component Tests
 *
 * Tests for the Divider component
 */

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Divider } from '../../components/divider.js'

describe('Divider', () => {
  it('should render an hr element', () => {
    const { container } = render(<Divider />)

    const hr = container.querySelector('hr')
    expect(hr).toBeInTheDocument()
  })

  it('should have non-soft styling by default', () => {
    const { container } = render(<Divider />)

    const hr = container.querySelector('hr')
    expect(hr).toHaveClass('border-zinc-950/10')
    expect(hr).not.toHaveClass('border-zinc-950/5')
  })

  it('should apply soft styling when soft prop is true', () => {
    const { container } = render(<Divider soft />)

    const hr = container.querySelector('hr')
    expect(hr).toHaveClass('border-zinc-950/5')
    expect(hr).not.toHaveClass('border-zinc-950/10')
  })

  it('should apply custom className', () => {
    const { container } = render(<Divider className="my-divider" />)

    const hr = container.querySelector('hr')
    expect(hr).toHaveClass('my-divider')
  })

  it('should always have base classes', () => {
    const { container } = render(<Divider />)

    const hr = container.querySelector('hr')
    expect(hr).toHaveClass('w-full')
    expect(hr).toHaveClass('border-t')
  })

  it('should pass through additional hr attributes', () => {
    const { container } = render(<Divider data-testid="custom-divider" id="divider-1" />)

    const hr = container.querySelector('hr')
    expect(hr).toHaveAttribute('data-testid', 'custom-divider')
    expect(hr).toHaveAttribute('id', 'divider-1')
  })
})
