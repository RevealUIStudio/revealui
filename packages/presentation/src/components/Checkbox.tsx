'use client'
import React from 'react'
import { cn } from '../utils/cn'

// Context for managing checkbox state
const CheckboxContext = React.createContext<{
  state: boolean | 'indeterminate'
  disabled?: boolean
  onCheckedChange?: (checked: boolean | 'indeterminate') => void
} | null>(null)

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'checked' | 'defaultChecked'> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?(checked: boolean | 'indeterminate'): void
}

// Checkbox component
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, defaultChecked, disabled, onCheckedChange, className, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState<boolean | 'indeterminate'>(
      defaultChecked || false,
    )

    const handleClick = () => {
      if (disabled) return

      const newChecked = internalChecked === 'indeterminate' ? true : !internalChecked
      setInternalChecked(newChecked)
      onCheckedChange?.(newChecked)
    }

    React.useEffect(() => {
      if (checked !== undefined) {
        setInternalChecked(checked)
      }
    }, [checked])

    return (
      <CheckboxContext.Provider value={{ state: internalChecked, disabled, onCheckedChange }}>
        <button
          type="button"
          role="checkbox"
          aria-checked={internalChecked === 'indeterminate' ? 'mixed' : internalChecked}
          disabled={disabled}
          onClick={handleClick}
          ref={ref}
          className={cn(
            'peer h-4 w-4 shrink-0 rounded border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
            className,
          )}
          data-state={
            internalChecked === 'indeterminate'
              ? 'indeterminate'
              : internalChecked
                ? 'checked'
                : 'unchecked'
          }
          {...props}
        >
          {props.children}
        </button>
      </CheckboxContext.Provider>
    )
  },
)

Checkbox.displayName = 'Checkbox'

export interface CheckboxIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {}

// CheckboxIndicator component
const CheckboxIndicator = React.forwardRef<HTMLSpanElement, CheckboxIndicatorProps>(
  ({ className, ...props }, ref) => {
    const context = React.useContext(CheckboxContext)
    if (!context) {
      throw new Error('CheckboxIndicator must be used within a Checkbox')
    }

    return (
      <span
        data-state={
          context.state === 'indeterminate'
            ? 'indeterminate'
            : context.state
              ? 'checked'
              : 'unchecked'
        }
        ref={ref}
        className={cn('flex items-center justify-center text-current', className)}
        {...props}
      >
        {context.state === true && '✔'}
        {context.state === 'indeterminate' && '−'}
      </span>
    )
  },
)

CheckboxIndicator.displayName = 'CheckboxIndicator'

// Export components
export { Checkbox, CheckboxIndicator }
