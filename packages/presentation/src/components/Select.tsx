'use client';

import type React from 'react';
import { Box, type BoxProps } from '../primitives/Box.js';
import { cn } from '../utils/cn.js';

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
  );
};

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
  );
};

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
  );
};

export interface SelectProps extends BoxProps {
  onValueChange?: (value: string) => void;
  value?: string;
}

function Select({ children, className, ref, ...props }: SelectProps) {
  return (
    <Box ref={ref} className={cn(className)} {...props}>
      {children}
    </Box>
  );
}

Select.displayName = 'Select';

function SelectGroup({ children, className, ref, ...props }: BoxProps) {
  return (
    <Box ref={ref} className={cn(className)} {...props}>
      {children}
    </Box>
  );
}

export interface SelectValueProps extends BoxProps {
  placeholder?: string;
  value?: string;
}

function SelectValue({
  placeholder,
  children,
  value,
  ref,
  ...props
}: SelectValueProps & { ref?: React.Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} {...props}>
      {children || placeholder || value}
    </span>
  );
}

export type SelectTriggerProps = BoxProps;

function SelectTrigger({ children, className, ref, ...props }: SelectTriggerProps) {
  return (
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
  );
}

SelectTrigger.displayName = 'SelectTrigger';

export type SelectScrollUpButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: React.Ref<HTMLButtonElement>;
};

function SelectScrollUpButton({ className, ref, ...props }: SelectScrollUpButtonProps) {
  return (
    <button
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      ref={ref}
      {...props}
    >
      <ChevronUp className="size-4" />
    </button>
  );
}

export type SelectScrollDownButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: React.Ref<HTMLButtonElement>;
};

function SelectScrollDownButton({ className, ref, ...props }: SelectScrollDownButtonProps) {
  return (
    <button
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      ref={ref}
      {...props}
    >
      <ChevronDown className="size-4" />
    </button>
  );
}

export type SelectContentProps = BoxProps;

function SelectContent({ children, className, ref, ...props }: SelectContentProps) {
  return (
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
  );
}

SelectContent.displayName = 'SelectContent';

export type SelectLabelProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

function SelectLabel({ className, ref, ...props }: SelectLabelProps) {
  return (
    <div className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)} ref={ref} {...props} />
  );
}

export interface SelectItemProps extends BoxProps {
  value?: string;
}

function SelectItem({ children, className, value, ref, ...props }: SelectItemProps) {
  return (
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
  );
}

SelectItem.displayName = 'SelectItem';

export type SelectSeparatorProps = BoxProps;

function SelectSeparator({ className, ref, ...props }: SelectSeparatorProps) {
  return <Box className={cn('-mx-1 my-1 h-px bg-muted', className)} ref={ref} {...props} />;
}

SelectSeparator.displayName = 'SelectSeparator';

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
};
