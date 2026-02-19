import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Callout } from '../../components/callout.js'

describe('Callout', () => {
  it('renders children content', () => {
    render(<Callout>This is important information</Callout>)
    expect(screen.getByText('This is important information')).toBeInTheDocument()
  })

  it('renders a title when provided', () => {
    render(<Callout title="Note">Callout body text</Callout>)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.getByText('Callout body text')).toBeInTheDocument()
  })

  it('renders each variant without crashing', () => {
    const variants = ['info', 'warning', 'error', 'success', 'tip'] as const
    for (const variant of variants) {
      const { unmount } = render(<Callout variant={variant}>Content</Callout>)
      expect(screen.getByText('Content')).toBeInTheDocument()
      unmount()
    }
  })
})
