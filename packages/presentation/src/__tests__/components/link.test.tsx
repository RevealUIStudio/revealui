/**
 * Link Component Tests
 *
 * Tests for the Link component
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Link } from '../../components/link.js'

describe('Link', () => {
  it('should render an anchor element', () => {
    render(<Link href="/home">Home</Link>)

    const link = screen.getByRole('link', { name: 'Home' })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
  })

  it('should set the href attribute', () => {
    render(<Link href="/about">About</Link>)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/about')
  })

  it('should forward ref to anchor element', () => {
    const ref = { current: null as HTMLAnchorElement | null }

    render(
      <Link ref={ref} href="/test">
        Test
      </Link>,
    )

    expect(ref.current).toBeInstanceOf(HTMLAnchorElement)
    expect(ref.current?.tagName).toBe('A')
  })

  it('should render children content', () => {
    render(<Link href="/docs">Documentation</Link>)

    expect(screen.getByText('Documentation')).toBeInTheDocument()
  })

  it('should pass through additional anchor attributes', () => {
    render(
      <Link href="/external" target="_blank" rel="noopener noreferrer">
        External
      </Link>,
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should apply custom className', () => {
    render(
      <Link href="/styled" className="custom-link">
        Styled
      </Link>,
    )

    const link = screen.getByRole('link')
    expect(link).toHaveClass('custom-link')
  })

  it('should support aria-label', () => {
    render(
      <Link href="/a11y" aria-label="Accessible link">
        Click
      </Link>,
    )

    expect(screen.getByLabelText('Accessible link')).toBeInTheDocument()
  })
})
