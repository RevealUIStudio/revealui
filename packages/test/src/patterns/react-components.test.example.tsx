/**
 * Example: Testing React Components
 *
 * This file demonstrates how to test React components with @testing-library/react
 *
 * Usage: Copy patterns from this file to your actual test files
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

// Example component to test (replace with your actual component)
interface ButtonProps {
  label: string
  onClick: () => void
}

function _Button({ label, onClick }: ButtonProps) {
  return (
    <button onClick={onClick} aria-label={label}>
      {label}
    </button>
  )
}

describe('React Component Testing Patterns', () => {
  describe('Component Rendering', () => {
    it('should render component', () => {
      render(<Button label="Click me" onClick={() => {}} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('should render with props', () => {
      const handleClick = () => {}
      render(<Button label="Test Button" onClick={handleClick} />)

      const button = screen.getByRole('button', { name: 'Test Button' })
      expect(button).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle click events', async () => {
      const handleClick = () => {
        // Click handler logic
      }
      const user = userEvent.setup()

      render(<Button label="Click me" onClick={handleClick} />)

      const button = screen.getByRole('button')
      await user.click(button)

      // Assert expected behavior
    })

    it('should handle form input', async () => {
      const user = userEvent.setup()

      // Render component with input
      // ... component rendering code

      const input = screen.getByLabelText('Email')
      await user.type(input, 'test@example.com')

      expect(input).toHaveValue('test@example.com')
    })
  })

  describe('Component State', () => {
    it('should update state on interaction', async () => {
      // Test component state changes
      // Example: Counter component that increments on click
    })

    it('should handle async state updates', async () => {
      // Test components with async operations
      // Use waitFor for async updates

      await waitFor(() => {
        expect(screen.getByText('Loaded')).toBeInTheDocument()
      })
    })
  })

  describe('Component Props', () => {
    it('should handle prop changes', () => {
      const { rerender } = render(<Button label="Initial" onClick={() => {}} />)

      expect(screen.getByText('Initial')).toBeInTheDocument()

      rerender(<Button label="Updated" onClick={() => {}} />)

      expect(screen.getByText('Updated')).toBeInTheDocument()
    })
  })
})
