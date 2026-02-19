import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tab, TabList, TabPanel, Tabs } from '../../components/tabs.js'

function BasicTabs({ defaultTab }: { defaultTab?: string }) {
  return (
    <Tabs defaultTab={defaultTab ?? 'tab1'}>
      <TabList>
        <Tab id="tab1">Tab One</Tab>
        <Tab id="tab2">Tab Two</Tab>
      </TabList>
      <TabPanel id="tab1">Panel One</TabPanel>
      <TabPanel id="tab2">Panel Two</TabPanel>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('renders all tabs', () => {
    render(<BasicTabs />)
    expect(screen.getByText('Tab One')).toBeInTheDocument()
    expect(screen.getByText('Tab Two')).toBeInTheDocument()
  })

  it('shows the default tab panel', () => {
    render(<BasicTabs defaultTab="tab1" />)
    expect(screen.getByText('Panel One')).toBeInTheDocument()
    expect(screen.queryByText('Panel Two')).not.toBeInTheDocument()
  })

  it('switches panel on tab click', async () => {
    const user = userEvent.setup()
    render(<BasicTabs />)
    await user.click(screen.getByText('Tab Two'))
    expect(screen.queryByText('Panel One')).not.toBeInTheDocument()
    expect(screen.getByText('Panel Two')).toBeInTheDocument()
  })

  it('sets aria-selected on active tab', async () => {
    const user = userEvent.setup()
    render(<BasicTabs />)
    const [tab1, tab2] = screen.getAllByRole('tab')
    expect(tab1).toHaveAttribute('aria-selected', 'true')
    expect(tab2).toHaveAttribute('aria-selected', 'false')

    await user.click(tab2)
    expect(tab1).toHaveAttribute('aria-selected', 'false')
    expect(tab2).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onChange when tab changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Tabs defaultTab="tab1" onChange={onChange}>
        <TabList>
          <Tab id="tab1">One</Tab>
          <Tab id="tab2">Two</Tab>
        </TabList>
        <TabPanel id="tab1">P1</TabPanel>
        <TabPanel id="tab2">P2</TabPanel>
      </Tabs>,
    )
    await user.click(screen.getByText('Two'))
    expect(onChange).toHaveBeenCalledWith('tab2')
  })

  it('tablist has correct role', () => {
    render(<BasicTabs />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})
