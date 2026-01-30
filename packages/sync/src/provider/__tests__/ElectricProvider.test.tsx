import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ElectricProvider } from '../index.js'

describe('ElectricProvider', () => {
  it('should render children', () => {
    render(
      <ElectricProvider>
        <div data-testid="child">Test Child</div>
      </ElectricProvider>,
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })

  it('should accept serviceUrl prop', () => {
    // Provider accepts the prop but doesn't use it yet (placeholder implementation)
    expect(() => {
      render(
        <ElectricProvider serviceUrl="http://localhost:3000">
          <div>Child</div>
        </ElectricProvider>,
      )
    }).not.toThrow()
  })

  it('should accept debug prop', () => {
    // Provider accepts the prop but doesn't use it yet (placeholder implementation)
    expect(() => {
      render(
        <ElectricProvider debug={true}>
          <div>Child</div>
        </ElectricProvider>,
      )
    }).not.toThrow()
  })

  it('should render multiple children', () => {
    render(
      <ElectricProvider>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </ElectricProvider>,
    )

    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })

  it('should handle null children', () => {
    expect(() => {
      render(<ElectricProvider>{null}</ElectricProvider>)
    }).not.toThrow()
  })

  it('should handle nested providers', () => {
    render(
      <ElectricProvider serviceUrl="http://outer">
        <ElectricProvider serviceUrl="http://inner">
          <div data-testid="nested-child">Nested</div>
        </ElectricProvider>
      </ElectricProvider>,
    )

    expect(screen.getByTestId('nested-child')).toBeInTheDocument()
  })
})
