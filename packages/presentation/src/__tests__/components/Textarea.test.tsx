/**
 * Textarea Component Tests
 *
 * Tests for the Textarea form component
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Textarea } from '../../components/Textarea.js'

describe('Textarea', () => {
  it('should render without crashing', () => {
    render(<Textarea />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('should render with placeholder', () => {
    render(<Textarea placeholder="Enter description" />)

    expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument()
  })

  it('should forward ref to textarea element', () => {
    const ref = { current: null as HTMLTextAreaElement | null }

    render(<Textarea ref={ref} />)

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    expect(ref.current?.tagName).toBe('TEXTAREA')
  })

  it('should handle onChange events', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(<Textarea onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello')

    expect(handleChange).toHaveBeenCalled()
    expect(handleChange).toHaveBeenCalledTimes(5)
  })

  it('should update value when typing', async () => {
    const user = userEvent.setup()

    render(<Textarea />)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await user.type(textarea, 'New text')

    expect(textarea.value).toBe('New text')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Textarea disabled />)

    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('should not accept input when disabled', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(<Textarea disabled onChange={handleChange} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Test')

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    const { container } = render(<Textarea className="custom-textarea" />)

    const textarea = container.querySelector('textarea')
    expect(textarea).toHaveClass('custom-textarea')
  })

  it('should render with default value', () => {
    render(<Textarea defaultValue="Default content" />)

    expect(screen.getByDisplayValue('Default content')).toBeInTheDocument()
  })
})
