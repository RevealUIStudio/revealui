'use client'
import React from 'react'

// Context for managing checkbox state
const CheckboxContext = React.createContext<{
  state: boolean | 'indeterminate'
  disabled?: boolean
  onCheckedChange?: (checked: boolean | 'indeterminate') => void
} | null>(null)

// Checkbox component
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, defaultChecked, disabled, onCheckedChange, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState<boolean | 'indeterminate'>(
      defaultChecked ?? false, // default to false if undefined
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
        {/* biome-ignore lint/a11y/useSemanticElements: custom checkbox styling uses a button with ARIA attributes. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={internalChecked === 'indeterminate' ? 'mixed' : internalChecked}
          disabled={disabled}
          onClick={handleClick}
          ref={ref}
          {...props}
        >
          {props.children}
        </button>
      </CheckboxContext.Provider>
    )
  },
)

Checkbox.displayName = 'Checkbox'

interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'checked' | 'defaultChecked'> {
  checked?: boolean // Keep checked as boolean
  defaultChecked?: boolean // Restrict defaultChecked to boolean only
  onCheckedChange?(checked: boolean | 'indeterminate'): void // Callback for checked state change
}

// CheckboxIndicator component
const CheckboxIndicator = React.forwardRef<HTMLSpanElement, CheckboxIndicatorProps>(
  (props, ref) => {
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
        {...props}
      >
        {context.state === true && '✔'} {/* Check mark for checked state */}
        {context.state === 'indeterminate' && '−'} {/* Indeterminate mark */}
      </span>
    )
  },
)

CheckboxIndicator.displayName = 'CheckboxIndicator'

interface CheckboxIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {}

// Export components
export { Checkbox, CheckboxIndicator }
export type { CheckboxIndicatorProps, CheckboxProps }

// "use client";

// import { layoutUtils } from "reveal";
// import { Check } from "assets";
// import * as React from "react";

// const Checkbox = React.forwardRef<
//   React.ElementRef<typeof CheckboxPrimitive.Root>,
//   React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
// >(({ className, ...props }, ref) => (
//   <CheckboxPrimitive.Root
//     className={cn(
//       "peer h-4 w-4 shrink-0 rounded border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
//       className,
//     )}
//     ref={ref}
//     {...props}
//   >
//     <CheckboxPrimitive.Indicator
//       className={cn("flex items-center justify-center text-current")}
//     >
//       <Check className="h-4 w-4" />
//     </CheckboxPrimitive.Indicator>
//   </CheckboxPrimitive.Root>
// ));
// Checkbox.displayName = CheckboxPrimitive.Root.displayName;

// export { Checkbox };
