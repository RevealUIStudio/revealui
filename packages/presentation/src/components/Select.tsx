'use client'

import React from 'react'
import { Box, type BoxProps } from '../primitives/Box'
import { cn } from '../utils/cn'

const Check = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn('size-6', className)}
    >
      <title>Selected</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12l4 4L18 8" />
    </svg>
  )
}

const ChevronUp = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn('size-6', className)}
    >
      <title>Scroll up</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 15.75l-7.5-7.5-7.5 7.5" />
    </svg>
  )
}

const ChevronDown = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn('size-6', className)}
    >
      <title>Scroll down</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.25l7.5 7.5 7.5-7.5" />
    </svg>
  )
}

export interface SelectProps extends BoxProps {
  onValueChange?: (value: string) => void
  value?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ children, className, ...props }, ref) => (
    <Box ref={ref} className={cn(className)} {...props}>
      {children}
    </Box>
  ),
)
Select.displayName = 'Select'

const SelectGroup = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ children, className, ...props }, ref) => (
    <Box ref={ref} className={cn(className)} {...props}>
      {children}
    </Box>
  ),
)
SelectGroup.displayName = 'SelectGroup'

export interface SelectValueProps extends BoxProps {
  placeholder?: string
  value?: string
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ placeholder, children, value, ...props }, ref) => (
    <span ref={ref} {...props}>
      {children || placeholder || value}
    </span>
  ),
)
SelectValue.displayName = 'SelectValue'

export type SelectTriggerProps = BoxProps

const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>(
  ({ children, className, ...props }, ref) => (
    <Box
      className={cn(
        'flex h-10 w-full items-center justify-between rounded border border-input bg-background px-3 py-2 text-inherit ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
      <ChevronDown className="size-4 opacity-50" />
    </Box>
  ),
)
SelectTrigger.displayName = 'SelectTrigger'

export type SelectScrollUpButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const SelectScrollUpButton = React.forwardRef<HTMLButtonElement, SelectScrollUpButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      ref={ref}
      {...props}
    >
      <ChevronUp className="size-4" />
    </button>
  ),
)
SelectScrollUpButton.displayName = 'SelectScrollUpButton'

export type SelectScrollDownButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const SelectScrollDownButton = React.forwardRef<HTMLButtonElement, SelectScrollDownButtonProps>(
  ({ className, ...props }, ref) => (
    <button
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      ref={ref}
      {...props}
    >
      <ChevronDown className="size-4" />
    </button>
  ),
)
SelectScrollDownButton.displayName = 'SelectScrollDownButton'

export type SelectContentProps = BoxProps

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ children, className, ...props }, ref) => (
    <Box
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
    </Box>
  ),
)
SelectContent.displayName = 'SelectContent'

export type SelectLabelProps = React.HTMLAttributes<HTMLDivElement>

const SelectLabel = React.forwardRef<HTMLDivElement, SelectLabelProps>(
  ({ className, ...props }, ref) => (
    <div className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)} ref={ref} {...props} />
  ),
)
SelectLabel.displayName = 'SelectLabel'

export interface SelectItemProps extends BoxProps {
  value?: string
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ children, className, value, ...props }, ref) => (
    <Box
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      data-value={value}
      ref={ref}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <Check className="size-4" />
      </span>
      <span>{children}</span>
    </Box>
  ),
)
SelectItem.displayName = 'SelectItem'

export type SelectSeparatorProps = BoxProps

const SelectSeparator = React.forwardRef<HTMLDivElement, SelectSeparatorProps>(
  ({ className, ...props }, ref) => (
    <Box className={cn('-mx-1 my-1 h-px bg-muted', className)} ref={ref} {...props} />
  ),
)
SelectSeparator.displayName = 'SelectSeparator'

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
