import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Kbd, KbdShortcut } from '../../components/kbd.js'

describe('Kbd', () => {
  it('renders key label text', () => {
    render(<Kbd>Enter</Kbd>)
    expect(screen.getByText('Enter')).toBeInTheDocument()
  })

  it('renders as a kbd element', () => {
    render(<Kbd>Ctrl</Kbd>)
    const el = screen.getByText('Ctrl')
    expect(el.tagName.toLowerCase()).toBe('kbd')
  })
})

describe('KbdShortcut', () => {
  it('renders all keys in the shortcut', () => {
    render(<KbdShortcut keys={['Ctrl', 'K']} />)
    expect(screen.getByText('Ctrl')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('renders with default separator', () => {
    const { container } = render(<KbdShortcut keys={['Cmd', 'Shift', 'P']} />)
    expect(container.textContent).toContain('Cmd')
    expect(container.textContent).toContain('Shift')
    expect(container.textContent).toContain('P')
  })
})
