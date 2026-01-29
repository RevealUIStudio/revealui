/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React from 'react'
// import { Check, ChevronDown, ChevronUp } from "assets";
import type { Theme } from '@/lib/providers/Theme/types'
import { cn } from '@/lib/styles/classnames'
import { Primitive } from './primitives/index.js'

const Check = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <title>Selected</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12l4 4L18 8" />
    </svg>
  )
}

const ChevronUp = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <title>Scroll up</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 15.75l-7.5-7.5-7.5 7.5" />
    </svg>
  )
}

const ChevronDown = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <title>Scroll down</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.25l7.5 7.5 7.5-7.5" />
    </svg>
  )
}
type SelectProps = {
  onValueChange: (themeToSet: Theme & 'auto') => void // Ensure this matches your logic
  value: string // Ensure this is a string type
} & React.ComponentPropsWithoutRef<typeof Primitive.div>

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ children, className, ...props }, ref) => (
    <Primitive.div ref={ref} className={cn(className)} {...props}>
      {children}
    </Primitive.div>
  ),
)
Select.displayName = 'Select' // Add display name
const SelectGroup = Primitive.div // Use your custom group implementation
// const SelectValue = Primitive.span; // Use your custom value display
// const SelectValue = React.forwardRef<
//   HTMLSpanElement,
//   React.ComponentPropsWithoutRef<typeof Primitive.span> & {
//     placeholder?: string;
//   }
// >(({ placeholder, children, ...props }, ref) => (
//   <Primitive.span ref={ref} {...props}>
//     {children || placeholder}
//   </Primitive.span>
// ));
const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof Primitive.span> & {
    placeholder?: string
    value?: string // Add this line to accept the value prop
  }
>(({ placeholder, children, value, ...props }, ref) => (
  <Primitive.span ref={ref} {...props}>
    {children || placeholder || value}
  </Primitive.span>
))
SelectValue.displayName = 'SelectValue' // Add display name

// Define SelectTrigger component
const SelectTrigger = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ children, className, ...props }, ref) => (
  <Primitive.div
    className={cn(
      'flex h-10 w-full items-center justify-between rounded border border-input bg-background px-3 py-2 text-inherit ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <ChevronDown className="size-4 opacity-50" />
  </Primitive.div>
))
SelectTrigger.displayName = 'SelectTrigger' // Add display name

// Define other components similarly...
const SelectScrollUpButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Primitive.button>
>(({ className, ...props }, ref) => (
  <Primitive.button
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    ref={ref}
    {...props}
  >
    <ChevronUp className="size-4" />
  </Primitive.button>
))
SelectScrollUpButton.displayName = 'SelectScrollUpButton' // Add display name

const SelectScrollDownButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Primitive.button>
>(({ className, ...props }, ref) => (
  <Primitive.button
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    ref={ref}
    {...props}
  >
    <ChevronDown className="size-4" />
  </Primitive.button>
))
SelectScrollDownButton.displayName = 'SelectScrollDownButton' // Add display name

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ children, className, ...props }, ref) => (
  <Primitive.div
    className={cn(
      'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded border bg-card text-popover-foreground shadow-md',
      className,
    )}
    ref={ref}
    {...props}
  >
    <SelectScrollUpButton />
    <div className="p-1">{children}</div>
    <SelectScrollDownButton />
  </Primitive.div>
))
SelectContent.displayName = 'SelectContent' // Add display name

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ className, ...props }, ref) => (
  <Primitive.div
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    ref={ref}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel' // Add display name

type SelectItemProps = React.ComponentPropsWithoutRef<typeof Primitive.div> & {
  value?: string // Add a value prop if needed
}
const SelectItem = React.forwardRef<React.ComponentRef<typeof Primitive.div>, SelectItemProps>(
  ({ children, className, ...props }, ref) => (
    <Primitive.div
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      ref={ref}
      {...props}

      // onClick={() => onValueChange(value)} // Call onValueChange with the value when clicked
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <Check className="size-4" />
      </span>
      <span>{children}</span>
    </Primitive.div>
  ),
)
SelectItem.displayName = 'SelectItem' // Add display name

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ className, ...props }, ref) => (
  <Primitive.div className={cn('-mx-1 my-1 h-px bg-muted', className)} ref={ref} {...props} />
))
SelectSeparator.displayName = 'SelectSeparator' // Add display name

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

// "use client";

// import { layoutUtils } from "reveal";
// import { Check, ChevronDown, ChevronUp } from "assets";
// import { Primitive as SelectPrimitive } from "./primitives/index.js"
// import React from "react";

// const Select = SelectPrimitive.Root;

// const SelectGroup = SelectPrimitive.Group;

// const SelectValue = SelectPrimitive.Value;

// const SelectTrigger = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.Trigger>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
// >(({ children, className, ...props }, ref) => (
//   <SelectPrimitive.Trigger
//     className={cn(
//       "flex h-10 w-full items-center justify-between rounded border border-input bg-background px-3 py-2 text-inherit ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
//       className,
//     )}
//     ref={ref}
//     {...props}
//   >
//     {children}
//     <SelectPrimitive.Icon asChild>
//       <ChevronDown className="size-4 opacity-50" />
//     </SelectPrimitive.Icon>
//   </SelectPrimitive.Trigger>
// ));
// SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

// const SelectScrollUpButton = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
// >(({ className, ...props }, ref) => (
//   <SelectPrimitive.ScrollUpButton
//     className={cn(
//       "flex cursor-default items-center justify-center py-1",
//       className,
//     )}
//     ref={ref}
//     {...props}
//   >
//     <ChevronUp className="size-4" />
//   </SelectPrimitive.ScrollUpButton>
// ));
// SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

// const SelectScrollDownButton = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
// >(({ className, ...props }, ref) => (
//   <SelectPrimitive.ScrollDownButton
//     className={cn(
//       "flex cursor-default items-center justify-center py-1",
//       className,
//     )}
//     ref={ref}
//     {...props}
//   >
//     <ChevronDown className="size-4" />
//   </SelectPrimitive.ScrollDownButton>
// ));
// SelectScrollDownButton.displayName =
//   SelectPrimitive.ScrollDownButton.displayName;

// const SelectContent = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.Content>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
// >(({ children, className, position = "popper", ...props }, ref) => (
//   <SelectPrimitive.Portal>
//     <SelectPrimitive.Content
//       className={cn(
//         "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded border bg-card text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
//         position === "popper" &&
//           "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
//         className,
//       )}
//       position={position}
//       ref={ref}
//       {...props}
//     >
//       <SelectScrollUpButton />
//       <SelectPrimitive.Viewport
//         className={cn(
//           "p-1",
//           position === "popper" &&
//             "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
//         )}
//       >
//         {children}
//       </SelectPrimitive.Viewport>
//       <SelectScrollDownButton />
//     </SelectPrimitive.Content>
//   </SelectPrimitive.Portal>
// ));
// SelectContent.displayName = SelectPrimitive.Content.displayName;

// const SelectLabel = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.Label>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
// >(({ className, ...props }, ref) => (
//   <SelectPrimitive.Label
//     className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
//     ref={ref}
//     {...props}
//   />
// ));
// SelectLabel.displayName = SelectPrimitive.Label.displayName;

// const SelectItem = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.Item>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
// >(({ children, className, ...props }, ref) => (
//   <SelectPrimitive.Item
//     className={cn(
//       "relative flex w-full cursor-default select-none items-center rounded py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
//       className,
//     )}
//     ref={ref}
//     {...props}
//   >
//     <span className="absolute left-2 flex size-3.5 items-center justify-center">
//       <SelectPrimitive.ItemIndicator>
//         <Check className="size-4" />
//       </SelectPrimitive.ItemIndicator>
//     </span>

//     <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
//   </SelectPrimitive.Item>
// ));
// SelectItem.displayName = SelectPrimitive.Item.displayName;

// const SelectSeparator = React.forwardRef<
//   React.ElementRef<typeof SelectPrimitive.Separator>,
//   React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
// >(({ className, ...props }, ref) => (
//   <SelectPrimitive.Separator
//     className={cn("-mx-1 my-1 h-px bg-muted", className)}
//     ref={ref}
//     {...props}
//   />
// ));
// SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// export {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectLabel,
//   SelectScrollDownButton,
//   SelectScrollUpButton,
//   SelectSeparator,
//   SelectTrigger,
//   SelectValue,
// };
