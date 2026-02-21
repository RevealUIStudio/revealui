import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Stat, StatGroup } from '../../components/stat.js'

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="Total users" value="1,234" />)
    expect(screen.getByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('renders change text when provided', () => {
    render(<Stat label="Revenue" value="$500" change="+12%" trend="up" />)
    expect(screen.getByText(/\+12%/)).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<Stat label="Count" value="42" description="Last 30 days" />)
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('renders without optional props', () => {
    render(<Stat label="Simple" value="0" />)
    expect(screen.getByText('Simple')).toBeInTheDocument()
  })
})

describe('StatGroup', () => {
  it('renders multiple stats', () => {
    render(
      <StatGroup>
        <Stat label="Users" value="100" />
        <Stat label="Revenue" value="$200" />
      </StatGroup>,
    )
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
  })
})
