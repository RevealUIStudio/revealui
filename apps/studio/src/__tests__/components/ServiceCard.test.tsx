import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ServiceCard from '../../components/dashboard/ServiceCard'

describe('ServiceCard', () => {
  it('renders title and detail', () => {
    render(<ServiceCard title="WSL" status="running" detail="Ubuntu-24.04" />)

    expect(screen.getByText('WSL')).toBeInTheDocument()
    expect(screen.getByText('Ubuntu-24.04')).toBeInTheDocument()
  })

  it('renders running status text', () => {
    render(<ServiceCard title="WSL" status="running" detail="Ubuntu-24.04" />)

    // Both the detail and the capitalized status text are present
    const statusParagraphs = screen.getAllByText('running')
    expect(statusParagraphs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders stopped status', () => {
    render(<ServiceCard title="Studio Drive" status="stopped" detail="Not mounted" />)

    expect(screen.getByText('stopped')).toBeInTheDocument()
    expect(screen.getByText('Not mounted')).toBeInTheDocument()
  })

  it('renders degraded status with correct detail', () => {
    render(<ServiceCard title="Systemd" status="degraded" detail="some units failed" />)

    expect(screen.getByText('degraded')).toBeInTheDocument()
    expect(screen.getByText('some units failed')).toBeInTheDocument()
  })

  it('renders the title as a heading', () => {
    render(<ServiceCard title="WSL" status="running" detail="Ubuntu" />)

    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('WSL')
  })
})
