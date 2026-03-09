/**
 * Switch Component Tests
 *
 * Tests for the Switch toggle component including controlled/uncontrolled
 * behavior, accessibility, disabled state, and form integration.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch, SwitchField, SwitchGroup } from '../../components/switch.js'

describe('Switch', () => {
  describe('Rendering', () => {
    it('should render with switch role', () => {
      render(<Switch />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
    })

    it('should render as a button element', () => {
      render(<Switch />)

      const toggle = screen.getByRole('switch')
      expect(toggle.tagName).toBe('BUTTON')
      expect(toggle).toHaveAttribute('type', 'button')
    })

    it('should render unchecked by default', () => {
      render(<Switch />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('Controlled mode', () => {
    it('should reflect the checked prop', () => {
      render(<Switch checked={true} onChange={vi.fn()} />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it('should not change state on click when controlled', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Switch checked={false} onChange={vi.fn()} />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Still false because parent hasn't updated the prop
      expect(toggle).toHaveAttribute('aria-checked', 'false')

      rerender(<Switch checked={true} onChange={vi.fn()} />)
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it('should call onChange with the new value on click', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Switch checked={false} onChange={handleChange} />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      expect(handleChange).toHaveBeenCalledWith(true)
    })
  })

  describe('Uncontrolled mode', () => {
    it('should initialize with defaultChecked', () => {
      render(<Switch defaultChecked={true} />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it('should toggle on click', async () => {
      const user = userEvent.setup()

      render(<Switch />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'false')

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-checked', 'true')

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('Disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Switch disabled />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toBeDisabled()
    })

    it('should not toggle when disabled', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Switch disabled onChange={handleChange} />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      expect(handleChange).not.toHaveBeenCalled()
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('Form integration', () => {
    it('should render a hidden input when name is provided', () => {
      const { container } = render(<Switch name="notifications" />)

      const hiddenInput = container.querySelector('input[type="hidden"]')
      expect(hiddenInput).toBeInTheDocument()
      expect(hiddenInput).toHaveAttribute('name', 'notifications')
    })

    it('should not render a hidden input when name is not provided', () => {
      const { container } = render(<Switch />)

      const hiddenInput = container.querySelector('input[type="hidden"]')
      expect(hiddenInput).not.toBeInTheDocument()
    })

    it('should set hidden input value to "on" when checked and no value prop', async () => {
      const user = userEvent.setup()
      const { container } = render(<Switch name="notifications" />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      const hiddenInput = container.querySelector('input[type="hidden"]')
      expect(hiddenInput).toHaveAttribute('value', 'on')
    })

    it('should set hidden input value to custom value when checked', () => {
      const { container } = render(
        <Switch name="notifications" value="yes" defaultChecked={true} />,
      )

      const hiddenInput = container.querySelector('input[type="hidden"]')
      expect(hiddenInput).toHaveAttribute('value', 'yes')
    })

    it('should set hidden input value to empty string when unchecked', () => {
      const { container } = render(<Switch name="notifications" />)

      const hiddenInput = container.querySelector('input[type="hidden"]')
      expect(hiddenInput).toHaveAttribute('value', '')
    })
  })
})

describe('SwitchGroup', () => {
  it('should render children', () => {
    render(
      <SwitchGroup>
        <span>Group content</span>
      </SwitchGroup>,
    )

    expect(screen.getByText('Group content')).toBeInTheDocument()
  })

  it('should have data-slot="control"', () => {
    const { container } = render(
      <SwitchGroup data-testid="group">
        <span>Content</span>
      </SwitchGroup>,
    )

    expect(screen.getByTestId('group')).toHaveAttribute('data-slot', 'control')
  })
})

describe('SwitchField', () => {
  it('should render children', () => {
    render(
      <SwitchField>
        <span>Field content</span>
      </SwitchField>,
    )

    expect(screen.getByText('Field content')).toBeInTheDocument()
  })

  it('should have data-slot="field"', () => {
    render(
      <SwitchField data-testid="field">
        <span>Content</span>
      </SwitchField>,
    )

    expect(screen.getByTestId('field')).toHaveAttribute('data-slot', 'field')
  })

  it('should set data-disabled when disabled', () => {
    render(
      <SwitchField disabled data-testid="field">
        <span>Content</span>
      </SwitchField>,
    )

    expect(screen.getByTestId('field')).toHaveAttribute('data-disabled', '')
  })
})
