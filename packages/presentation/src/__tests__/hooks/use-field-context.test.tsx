import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  FieldProvider,
  useFieldContext,
  useFieldControlProps,
  useFieldDescriptionProps,
  useFieldErrorProps,
  useFieldLabelProps,
} from '../../hooks/use-field-context.js'

function FieldDisplay() {
  const ctx = useFieldContext()
  const controlProps = useFieldControlProps()
  const labelProps = useFieldLabelProps()
  const descriptionProps = useFieldDescriptionProps()
  const errorProps = useFieldErrorProps()

  return (
    <div>
      <span data-testid="has-context">{ctx ? 'yes' : 'no'}</span>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: htmlFor provided via spread */}
      <label data-testid="label" {...labelProps}>
        Name
      </label>
      <input data-testid="control" {...controlProps} />
      <span data-testid="description" {...descriptionProps}>
        Help text
      </span>
      <span data-testid="error" {...errorProps}>
        Error
      </span>
    </div>
  )
}

describe('useFieldContext', () => {
  it('should return null outside FieldProvider', () => {
    render(<FieldDisplay />)
    expect(screen.getByTestId('has-context')).toHaveTextContent('no')
  })

  it('should return context inside FieldProvider', () => {
    render(
      <FieldProvider>
        <FieldDisplay />
      </FieldProvider>,
    )
    expect(screen.getByTestId('has-context')).toHaveTextContent('yes')
  })
})

describe('useFieldControlProps', () => {
  it('should return empty object outside provider', () => {
    render(<FieldDisplay />)
    const control = screen.getByTestId('control')
    expect(control).not.toHaveAttribute('aria-labelledby')
  })

  it('should return ARIA props inside provider', () => {
    render(
      <FieldProvider>
        <FieldDisplay />
      </FieldProvider>,
    )
    const control = screen.getByTestId('control')
    expect(control).toHaveAttribute('id')
    expect(control).toHaveAttribute('aria-labelledby')
    expect(control).toHaveAttribute('aria-describedby')
  })

  it('should link label for attribute to control id', () => {
    render(
      <FieldProvider>
        <FieldDisplay />
      </FieldProvider>,
    )
    const control = screen.getByTestId('control')
    const label = screen.getByTestId('label')

    // React renders htmlFor as the for attribute in the DOM
    expect(label.getAttribute('for')).toBe(control.getAttribute('id'))
  })

  it('should link control aria-labelledby to label id', () => {
    render(
      <FieldProvider>
        <FieldDisplay />
      </FieldProvider>,
    )
    const control = screen.getByTestId('control')
    const label = screen.getByTestId('label')

    expect(control.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'))
  })

  it('should link control aria-describedby to description id', () => {
    render(
      <FieldProvider>
        <FieldDisplay />
      </FieldProvider>,
    )
    const control = screen.getByTestId('control')
    const description = screen.getByTestId('description')

    expect(control.getAttribute('aria-describedby')).toBe(description.getAttribute('id'))
  })
})

describe('FieldProvider disabled', () => {
  it('should set data-disabled on all elements when disabled', () => {
    render(
      <FieldProvider disabled>
        <FieldDisplay />
      </FieldProvider>,
    )

    expect(screen.getByTestId('control')).toHaveAttribute('data-disabled', '')
    expect(screen.getByTestId('label')).toHaveAttribute('data-disabled', '')
    expect(screen.getByTestId('description')).toHaveAttribute('data-disabled', '')
    expect(screen.getByTestId('error')).toHaveAttribute('data-disabled', '')
  })

  it('should not set data-disabled when not disabled', () => {
    render(
      <FieldProvider>
        <FieldDisplay />
      </FieldProvider>,
    )

    expect(screen.getByTestId('control')).not.toHaveAttribute('data-disabled')
    expect(screen.getByTestId('label')).not.toHaveAttribute('data-disabled')
  })
})
