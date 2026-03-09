/**
 * Select Headless Component Tests
 *
 * Tests the headless Select component for rendering, ref forwarding,
 * disabled/invalid states, and chevron icon behavior.
 */

import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Select } from '../../components/select-headless.js'

describe('Select', () => {
  it('should render a select element', () => {
    render(
      <Select>
        <option value="a">Option A</option>
      </Select>,
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should forward ref to the select element', () => {
    const ref = createRef<HTMLSelectElement>()

    render(
      <Select ref={ref}>
        <option value="a">Option A</option>
      </Select>,
    )

    expect(ref.current).toBeInstanceOf(HTMLSelectElement)
  })

  it('should render options', () => {
    render(
      <Select>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>,
    )

    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('should set data-disabled when disabled', () => {
    render(
      <Select disabled>
        <option value="a">Option A</option>
      </Select>,
    )

    const select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('data-disabled', '')
    expect(select).toBeDisabled()
  })

  it('should set data-invalid when invalid', () => {
    render(
      <Select invalid>
        <option value="a">Option A</option>
      </Select>,
    )

    const select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('data-invalid', '')
  })

  it('should render chevron icon in single mode', () => {
    const { container } = render(
      <Select>
        <option value="a">Option A</option>
      </Select>,
    )

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('should not render chevron icon in multiple mode', () => {
    const { container } = render(
      <Select multiple>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>,
    )

    const svg = container.querySelector('svg')
    expect(svg).not.toBeInTheDocument()
  })

  it('should wrap select in a span with data-slot="control"', () => {
    const { container } = render(
      <Select>
        <option value="a">Option A</option>
      </Select>,
    )

    const wrapper = container.querySelector('span[data-slot="control"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper?.querySelector('select')).toBeInTheDocument()
  })
})
