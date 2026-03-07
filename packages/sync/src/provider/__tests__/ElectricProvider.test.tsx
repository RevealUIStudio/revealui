import { render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ElectricProvider, useElectricConfig } from '../index.js'

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
    expect(() => {
      render(
        <ElectricProvider serviceUrl="http://localhost:3000">
          <div>Child</div>
        </ElectricProvider>,
      )
    }).not.toThrow()
  })

  it('should accept debug prop', () => {
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

describe('useElectricConfig', () => {
  it('should return defaults when no provider is present', () => {
    const { result } = renderHook(() => useElectricConfig())

    expect(result.current.serviceUrl).toBeNull()
    expect(result.current.debug).toBe(false)
  })

  it('should return provider values', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectricProvider serviceUrl="http://localhost:3000" debug={true}>
        {children}
      </ElectricProvider>
    )

    const { result } = renderHook(() => useElectricConfig(), { wrapper })

    expect(result.current.serviceUrl).toBe('http://localhost:3000')
    expect(result.current.debug).toBe(true)
  })
})
