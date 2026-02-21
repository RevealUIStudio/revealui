import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodeBlock } from '../../components/code-block.js'

describe('CodeBlock', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<CodeBlock code="copy me" showCopy />)
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('copy me')
  })
})
