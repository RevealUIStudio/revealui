/**
 * Checkbox Headless Component Tests
 *
 * Tests the headless Checkbox, CheckboxGroup, and CheckboxField components
 * for rendering, toggle behavior, controlled/uncontrolled state, and accessibility.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, CheckboxField, CheckboxGroup } from '../../components/checkbox-headless.js'

describe('Checkbox', () => {
  it('should render with checkbox role', () => {
    render(<Checkbox />)

    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('should be unchecked by default', () => {
    render(<Checkbox />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  it('should toggle on click', async () => {
    const user = userEvent.setup()

    render(<Checkbox />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'false')

    await user.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'true')

    await user.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  it('should work in controlled mode', () => {
    const { rerender } = render(<Checkbox checked={true} onChange={vi.fn()} />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'true')

    rerender(<Checkbox checked={false} onChange={vi.fn()} />)
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  it('should call onChange callback', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Checkbox onChange={handleChange} />)

    await user.click(screen.getByRole('checkbox'))
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('should not toggle when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Checkbox disabled onChange={handleChange} />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(handleChange).not.toHaveBeenCalled()
    expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  it('should set aria-checked to mixed when indeterminate', () => {
    render(<Checkbox indeterminate />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed')
  })

  it('should render hidden input when name is provided', () => {
    const { container } = render(<Checkbox name="agree" />)

    const hiddenInput = container.querySelector('input[type="hidden"]')
    expect(hiddenInput).toBeInTheDocument()
    expect(hiddenInput).toHaveAttribute('name', 'agree')
  })

  it('should not render hidden input when name is not provided', () => {
    const { container } = render(<Checkbox />)

    const hiddenInput = container.querySelector('input[type="hidden"]')
    expect(hiddenInput).not.toBeInTheDocument()
  })
})

describe('CheckboxGroup', () => {
  it('should render a div with data-slot="control"', () => {
    render(
      <CheckboxGroup data-testid="group">
        <span>Content</span>
      </CheckboxGroup>,
    )

    expect(screen.getByTestId('group')).toHaveAttribute('data-slot', 'control')
  })

  it('should render children', () => {
    render(
      <CheckboxGroup>
        <span>Group content</span>
      </CheckboxGroup>,
    )

    expect(screen.getByText('Group content')).toBeInTheDocument()
  })
})

describe('CheckboxField', () => {
  it('should render with data-slot="field"', () => {
    render(
      <CheckboxField data-testid="field">
        <span>Field content</span>
      </CheckboxField>,
    )

    expect(screen.getByTestId('field')).toHaveAttribute('data-slot', 'field')
  })

  it('should set data-disabled when disabled', () => {
    render(
      <CheckboxField disabled data-testid="field">
        <span>Content</span>
      </CheckboxField>,
    )

    expect(screen.getByTestId('field')).toHaveAttribute('data-disabled', '')
  })
})
