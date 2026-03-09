/**
 * Label Component Tests
 *
 * Tests the Label component for rendering, className,
 * and ref forwarding.
 */

import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Label } from '../../components/Label.js'

describe('Label', () => {
  it('should render a label element', () => {
    render(<Label data-testid="label">Username</Label>)
    expect(screen.getByTestId('label').tagName).toBe('LABEL')
  })

  it('should render children text', () => {
    render(<Label>Email</Label>)
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <Label className="my-label" data-testid="label">
        Name
      </Label>,
    )
    expect(screen.getByTestId('label')).toHaveClass('my-label')
  })

  it('should apply default typography classes', () => {
    render(<Label data-testid="label">Text</Label>)
    const label = screen.getByTestId('label')
    expect(label).toHaveClass('text-sm')
    expect(label).toHaveClass('font-medium')
  })

  it('should forward htmlFor prop', () => {
    render(
      <Label htmlFor="my-input" data-testid="label">
        Input Label
      </Label>,
    )
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'my-input')
  })

  it('should forward ref', () => {
    const ref = createRef<HTMLLabelElement>()
    render(<Label ref={ref}>Ref Label</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })

  it('should have displayName set to Label', () => {
    expect(Label.displayName).toBe('Label')
  })
})
