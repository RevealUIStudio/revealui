'use client'
import React from 'react'
import { cn } from '../utils/cn.js'

// Context for managing checkbox state
const CheckboxContext = React.createContext<{
  state: boolean | 'indeterminate'
  disabled?: boolean | undefined
  onCheckedChange?: (this: void, checked: boolean | 'indeterminate') => void
} | null>(null)

export interface CheckboxProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'checked' | 'defaultChecked' | 'type' | 'onChange'
  > {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?(this: void, checked: boolean | 'indeterminate'): void
}

// Checkbox component
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, defaultChecked, disabled, onCheckedChange, className, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState<boolean | 'indeterminate'>(
      defaultChecked ?? false,
    )

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return

      const newChecked = e.target.checked
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
        <input
          type="checkbox"
          disabled={disabled}
          checked={
            checked !== undefined
              ? checked
              : internalChecked === 'indeterminate'
                ? false
                : internalChecked
          }
          ref={(el) => {
            if (el) {
              el.indeterminate = internalChecked === 'indeterminate'
            }
            if (ref) {
              if (typeof ref === 'function') {
                ref(el)
              } else {
                ref.current = el
              }
            }
          }}
          onChange={handleChange}
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
        />
      </CheckboxContext.Provider>
    )
  },
)

Checkbox.displayName = 'Checkbox'

export type CheckboxIndicatorProps = React.HTMLAttributes<HTMLSpanElement>

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
