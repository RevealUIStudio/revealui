import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from '../../components/layout/Sidebar'

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Vault')).toBeInTheDocument()
    expect(screen.getByText('Infrastructure')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
    expect(screen.getByText('Tunnel')).toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('Setup')).toBeInTheDocument()
  })

  it('renders the brand name', () => {
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByText('RevealUI Studio')).toBeInTheDocument()
  })

  it('calls onNavigate when a nav item is clicked', () => {
    const onNavigate = vi.fn()
    render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('Vault'))

    expect(onNavigate).toHaveBeenCalledWith('vault')
  })

  it('highlights the current page', () => {
    render(<Sidebar currentPage="vault" onNavigate={vi.fn()} />)

    const vaultButton = screen.getByText('Vault').closest('button')
    expect(vaultButton?.className).toContain('bg-neutral-800')
    expect(vaultButton?.className).toContain('text-neutral-100')
  })

  it('does not highlight non-current pages', () => {
    render(<Sidebar currentPage="vault" onNavigate={vi.fn()} />)

    const dashboardButton = screen.getByText('Dashboard').closest('button')
    expect(dashboardButton?.className).toContain('text-neutral-400')
    expect(dashboardButton?.className).not.toContain('text-neutral-100')
  })

  it('navigates to each page', () => {
    const onNavigate = vi.fn()
    render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />)

    const pages = ['Dashboard', 'Vault', 'Infrastructure', 'Sync', 'Tunnel', 'Terminal', 'Setup']
    const pageIds = ['dashboard', 'vault', 'infrastructure', 'sync', 'tunnel', 'terminal', 'setup']

    for (let i = 0; i < pages.length; i++) {
      fireEvent.click(screen.getByText(pages[i]))
      expect(onNavigate).toHaveBeenCalledWith(pageIds[i])
    }
  })

  it('renders the R brand icon', () => {
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByText('R')).toBeInTheDocument()
  })
})
