import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CodeBlock } from '../../components/code-block.js'

// Silence the clipboard API warning in jsdom
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

describe('CodeBlock', () => {
  it('renders code content', () => {
    render(<CodeBlock code="const x = 1" />)
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
  })

  it('renders language label when provided', () => {
    render(<CodeBlock code="print('hello')" language="python" />)
    expect(screen.getByText('python')).toBeInTheDocument()
  })

  it('renders filename when provided', () => {
    render(<CodeBlock code="export default {}" filename="config.ts" />)
    expect(screen.getByText('config.ts')).toBeInTheDocument()
  })

  it('shows copy button by default', () => {
    render(<CodeBlock code="hello" showCopy />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('copy button triggers clipboard write', async () => {
    const user = userEvent.setup()
    render(<CodeBlock code="copy me" showCopy />)
    await user.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy me')
  })
})
