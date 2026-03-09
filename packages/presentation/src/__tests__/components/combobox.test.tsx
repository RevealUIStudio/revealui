/**
 * Combobox Component Tests
 *
 * Tests the Combobox compound component including input rendering,
 * filtering, selection, and keyboard navigation.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

import {
  Combobox,
  ComboboxDescription,
  ComboboxLabel,
  ComboboxOption,
} from '../../components/combobox.js'

interface Fruit {
  id: number
  name: string
}

const fruits: Fruit[] = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' },
  { id: 4, name: 'Apricot' },
]

function BasicCombobox({
  onChange,
  value,
  defaultValue,
}: {
  onChange?: (value: Fruit) => void
  value?: Fruit | null
  defaultValue?: Fruit | null
} = {}) {
  return (
    <Combobox
      options={fruits}
      displayValue={(f) => f?.name}
      aria-label="Fruit selector"
      placeholder="Select a fruit"
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
    >
      {(fruit) => (
        <ComboboxOption value={fruit}>
          <ComboboxLabel>{fruit.name}</ComboboxLabel>
        </ComboboxOption>
      )}
    </Combobox>
  )
}

describe('Combobox', () => {
  it('should render an input with combobox role', () => {
    render(<BasicCombobox />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should display placeholder text', () => {
    render(<BasicCombobox />)
    expect(screen.getByPlaceholderText('Select a fruit')).toBeInTheDocument()
  })

  it('should set aria-label on the input', () => {
    render(<BasicCombobox />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Fruit selector')
  })

  it('should open options listbox on focus', async () => {
    const user = userEvent.setup()
    render(<BasicCombobox />)

    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('should render all options when opened', async () => {
    const user = userEvent.setup()
    render(<BasicCombobox />)

    await user.click(screen.getByRole('combobox'))
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(4)
  })

  it('should filter options based on input text', async () => {
    const user = userEvent.setup()
    render(<BasicCombobox />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'Ap')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Apricot')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })

  it('should select an option on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BasicCombobox onChange={onChange} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.click(screen.getByText('Banana'))

    expect(onChange).toHaveBeenCalledWith(fruits[1])
  })

  it('should display selected value in the input', async () => {
    render(<BasicCombobox defaultValue={fruits[0]} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input.value).toBe('Apple')
  })

  it('should render toggle button', () => {
    render(<BasicCombobox />)
    expect(screen.getByLabelText('Toggle options')).toBeInTheDocument()
  })
})

describe('ComboboxOption subcomponents', () => {
  it('should render ComboboxLabel text', async () => {
    const user = userEvent.setup()
    render(<BasicCombobox />)

    await user.click(screen.getByRole('combobox'))
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('should render ComboboxDescription text', async () => {
    const user = userEvent.setup()
    render(
      <Combobox options={fruits} displayValue={(f) => f?.name} aria-label="Fruits">
        {(fruit) => (
          <ComboboxOption value={fruit}>
            <ComboboxLabel>{fruit.name}</ComboboxLabel>
            <ComboboxDescription>ID: {fruit.id}</ComboboxDescription>
          </ComboboxOption>
        )}
      </Combobox>,
    )

    await user.click(screen.getByRole('combobox'))
    expect(screen.getByText('ID: 1')).toBeInTheDocument()
  })
})
