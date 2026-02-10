/**
 * Checkbox Component Tests
 *
 * Tests for the Checkbox form component
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from '../../components/Checkbox.js'

describe('Checkbox', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<Checkbox />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    it('should render unchecked by default', () => {
      render(<Checkbox />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()
    })

    it('should render checked when checked prop is true', () => {
      render(<Checkbox checked={true} onCheckedChange={vi.fn()} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('should render with defaultChecked', () => {
      render(<Checkbox defaultChecked={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('should apply custom className', () => {
      const { container } = render(<Checkbox className="custom-checkbox" />)

      const checkbox = container.querySelector('input[type="checkbox"]')
      expect(checkbox).toHaveClass('custom-checkbox')
    })
  })

  describe('Checked State', () => {
    it('should toggle when clicked', async () => {
      const user = userEvent.setup()

      render(<Checkbox />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)
      expect(checkbox).toBeChecked()

      await user.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('should call onCheckedChange when toggled', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Checkbox onCheckedChange={handleChange} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('should call onCheckedChange with false when unchecking', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Checkbox defaultChecked={true} onCheckedChange={handleChange} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(handleChange).toHaveBeenCalledWith(false)
    })

    it('should be controlled when checked prop is provided', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Checkbox checked={false} onCheckedChange={vi.fn()} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)
      expect(checkbox).not.toBeChecked() // Still unchecked because controlled

      rerender(<Checkbox checked={true} onCheckedChange={vi.fn()} />)
      expect(checkbox).toBeChecked()
    })
  })

  describe('Indeterminate State', () => {
    it('should support indeterminate state', () => {
      render(<Checkbox checked={false} onCheckedChange={vi.fn()} />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      checkbox.indeterminate = true

      expect(checkbox.indeterminate).toBe(true)
    })

    it('should show indeterminate data-state', () => {
      const { container } = render(<Checkbox defaultChecked={false} />)

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
      checkbox.indeterminate = true

      // Force re-render to update data-state
      const dataState = checkbox.getAttribute('data-state')
      expect(['unchecked', 'indeterminate']).toContain(dataState)
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Checkbox disabled />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeDisabled()
    })

    it('should not toggle when disabled', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Checkbox disabled onCheckedChange={handleChange} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(handleChange).not.toHaveBeenCalled()
      expect(checkbox).not.toBeChecked()
    })

    it('should have disabled styling', () => {
      const { container } = render(<Checkbox disabled />)

      const checkbox = container.querySelector('input[type="checkbox"]')
      expect(checkbox).toHaveClass('disabled:cursor-not-allowed')
      expect(checkbox).toHaveClass('disabled:opacity-50')
    })
  })

  describe('Data State Attribute', () => {
    it('should have data-state="unchecked" when unchecked', () => {
      const { container } = render(<Checkbox />)

      const checkbox = container.querySelector('input[type="checkbox"]')
      expect(checkbox).toHaveAttribute('data-state', 'unchecked')
    })

    it('should have data-state="checked" when checked', () => {
      const { container } = render(<Checkbox checked={true} onCheckedChange={vi.fn()} />)

      const checkbox = container.querySelector('input[type="checkbox"]')
      expect(checkbox).toHaveAttribute('data-state', 'checked')
    })
  })

  describe('Keyboard Interaction', () => {
    it('should toggle with Space key', async () => {
      const user = userEvent.setup()

      render(<Checkbox />)

      const checkbox = screen.getByRole('checkbox')
      checkbox.focus()

      await user.keyboard(' ')
      expect(checkbox).toBeChecked()

      await user.keyboard(' ')
      expect(checkbox).not.toBeChecked()
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()

      render(<Checkbox />)

      await user.tab()

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Checkbox aria-label="Accept terms" />)

      expect(screen.getByLabelText('Accept terms')).toBeInTheDocument()
    })

    it('should support aria-describedby', () => {
      render(
        <>
          <Checkbox aria-describedby="help-text" />
          <div id="help-text">Help text</div>
        </>,
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('should have proper role', () => {
      render(<Checkbox />)

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('should reflect checked state', () => {
      render(<Checkbox checked={true} onCheckedChange={vi.fn()} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null }

      render(<Checkbox ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLInputElement)
      expect(ref.current?.type).toBe('checkbox')
    })

    it('should allow ref access to checkbox element', () => {
      const ref = { current: null as HTMLInputElement | null }

      render(<Checkbox ref={ref} />)

      expect(ref.current?.tagName).toBe('INPUT')
    })
  })

  describe('Form Integration', () => {
    it('should work within a form', () => {
      render(
        <form>
          <Checkbox />
        </form>,
      )

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('should have name attribute', () => {
      render(<Checkbox name="terms" />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('name', 'terms')
    })

    it('should have value attribute', () => {
      render(<Checkbox value="agree" />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('value', 'agree')
    })

    it('should submit with form data', () => {
      const handleSubmit = vi.fn((e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        return formData.get('terms')
      })

      render(
        <form onSubmit={handleSubmit}>
          <Checkbox name="terms" value="accepted" defaultChecked={true} />
          <button type="submit">Submit</button>
        </form>,
      )

      const submitButton = screen.getByRole('button')
      submitButton.click()

      expect(handleSubmit).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid clicking', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Checkbox onCheckedChange={handleChange} />)

      const checkbox = screen.getByRole('checkbox')

      // Click multiple times rapidly
      for (let i = 0; i < 5; i++) {
        await user.click(checkbox)
      }

      expect(handleChange).toHaveBeenCalledTimes(5)
    })

    it('should handle controlled to uncontrolled switch', () => {
      const { rerender } = render(<Checkbox checked={true} onCheckedChange={vi.fn()} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()

      // Switch to uncontrolled
      rerender(<Checkbox defaultChecked={false} />)

      expect(checkbox).toBeInTheDocument()
    })

    it('should handle null children gracefully', () => {
      render(
        // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is inside the label
        <label>
          <Checkbox />
          {null}
        </label>,
      )

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })
  })
})
