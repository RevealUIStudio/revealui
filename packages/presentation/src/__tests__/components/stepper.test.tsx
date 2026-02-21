import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StepperStep } from '../../components/stepper.js'
import { Stepper } from '../../components/stepper.js'

const steps: StepperStep[] = [
  { label: 'Account', status: 'complete' },
  { label: 'Profile', status: 'current' },
  { label: 'Review', status: 'upcoming' },
]

describe('Stepper', () => {
  it('renders all step labels', () => {
    render(<Stepper steps={steps} />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('renders step descriptions when provided', () => {
    const withDesc: StepperStep[] = [
      { label: 'Details', description: 'Fill in your info', status: 'current' },
    ]
    // Descriptions are only rendered in vertical orientation
    render(<Stepper steps={withDesc} orientation="vertical" />)
    expect(screen.getByText('Fill in your info')).toBeInTheDocument()
  })

  it('renders horizontal orientation by default', () => {
    const { container } = render(<Stepper steps={steps} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders vertical orientation', () => {
    const { container } = render(<Stepper steps={steps} orientation="vertical" />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
