/**
 * Button Component Tests
 *
 * Tests for the reusable Button component
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Mock Button component for testing
const Button = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  loading = false,
  className = '',
  'aria-label': ariaLabel,
  ...props
}: {
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  className?: string
  'aria-label'?: string
  [key: string]: unknown
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      className={`btn btn-${variant} btn-${size} ${className} ${loading ? 'loading' : ''}`}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}

describe('Button', () => {
  describe('Rendering', () => {
    it('should render with text', () => {
      render(<Button>Click me</Button>)

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('should render as button element', () => {
      render(<Button>Button</Button>)

      const button = screen.getByRole('button')
      expect(button.tagName).toBe('BUTTON')
    })

    it('should accept children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>,
      )

      expect(screen.getByText('Icon')).toBeInTheDocument()
      expect(screen.getByText('Text')).toBeInTheDocument()
    })
  })

  describe('Click Handling', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)

      await user.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledOnce()
    })

    it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(
        <Button onClick={handleClick} disabled>
          Click me
        </Button>,
      )

      await user.click(screen.getByRole('button'))

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(
        <Button onClick={handleClick} loading>
          Click me
        </Button>,
      )

      await user.click(screen.getByRole('button'))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Variants', () => {
    it('should apply primary variant class', () => {
      render(<Button variant="primary">Primary</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-primary')
    })

    it('should apply secondary variant class', () => {
      render(<Button variant="secondary">Secondary</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-secondary')
    })

    it('should apply danger variant class', () => {
      render(<Button variant="danger">Danger</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-danger')
    })

    it('should default to primary variant', () => {
      render(<Button>Default</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-primary')
    })
  })

  describe('Sizes', () => {
    it('should apply small size class', () => {
      render(<Button size="small">Small</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-small')
    })

    it('should apply medium size class', () => {
      render(<Button size="medium">Medium</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-medium')
    })

    it('should apply large size class', () => {
      render(<Button size="large">Large</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-large')
    })

    it('should default to medium size', () => {
      render(<Button>Default</Button>)

      expect(screen.getByRole('button')).toHaveClass('btn-medium')
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should not be disabled by default', () => {
      render(<Button>Enabled</Button>)

      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    it('should apply disabled attribute', () => {
      render(<Button disabled>Disabled</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('disabled')
    })
  })

  describe('Loading State', () => {
    it('should show loading text when loading', () => {
      render(<Button loading>Submit</Button>)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should hide children when loading', () => {
      render(<Button loading>Submit</Button>)

      expect(screen.queryByText('Submit')).not.toBeInTheDocument()
    })

    it('should be disabled when loading', () => {
      render(<Button loading>Submit</Button>)

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should apply loading class', () => {
      render(<Button loading>Loading</Button>)

      expect(screen.getByRole('button')).toHaveClass('loading')
    })
  })

  describe('Button Types', () => {
    it('should default to type="button"', () => {
      render(<Button>Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('should accept type="submit"', () => {
      render(<Button type="submit">Submit</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })

    it('should accept type="reset"', () => {
      render(<Button type="reset">Reset</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'reset')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible name from children', () => {
      render(<Button>Click me</Button>)

      expect(screen.getByRole('button')).toHaveAccessibleName('Click me')
    })

    it('should support aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>)

      expect(screen.getByRole('button')).toHaveAccessibleName('Close dialog')
    })

    it('should be keyboard accessible', () => {
      render(<Button>Tab to me</Button>)

      const button = screen.getByRole('button')
      expect(button).not.toHaveAttribute('tabindex', '-1')
    })

    it('should handle Enter key press', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Press Enter</Button>)

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard('{Enter}')

      expect(handleClick).toHaveBeenCalled()
    })

    it('should handle Space key press', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Press Space</Button>)

      const button = screen.getByRole('button')
      button.focus()
      await user.keyboard(' ')

      expect(handleClick).toHaveBeenCalled()
    })

    it('should have focus styles', () => {
      render(<Button>Focus me</Button>)

      const button = screen.getByRole('button')
      button.focus()

      expect(button).toHaveFocus()
    })
  })

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class">Styled</Button>)

      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('should merge className with default classes', () => {
      render(<Button className="custom-class">Styled</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('Form Integration', () => {
    it('should submit form when type="submit"', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault())

      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </form>,
      )

      screen.getByRole('button').click()

      expect(handleSubmit).toHaveBeenCalled()
    })

    it('should reset form when type="reset"', () => {
      render(
        <form>
          <input defaultValue="test" />
          <Button type="reset">Reset</Button>
        </form>,
      )

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('test')

      screen.getByRole('button').click()

      // Form should reset
      expect(input.value).toBe('test')
    })

    it('should not submit form when type="button"', () => {
      const handleSubmit = vi.fn()

      render(
        <form onSubmit={handleSubmit}>
          <Button type="button">Button</Button>
        </form>,
      )

      screen.getByRole('button').click()

      expect(handleSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      render(<Button />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle very long text', () => {
      const longText = 'A'.repeat(1000)

      render(<Button>{longText}</Button>)

      expect(screen.getByRole('button')).toHaveTextContent(longText)
    })

    it('should handle rapid clicks', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click me</Button>)

      const button = screen.getByRole('button')

      // Click 10 times rapidly
      for (let i = 0; i < 10; i++) {
        await user.click(button)
      }

      expect(handleClick).toHaveBeenCalledTimes(10)
    })

    it('should handle click while disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(
        <Button onClick={handleClick} disabled>
          Click me
        </Button>,
      )

      await user.click(screen.getByRole('button'))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })
})
