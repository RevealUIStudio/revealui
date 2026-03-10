import type * as React from 'react'
import { cn } from '../utils/cn.js'
import type { ButtonProps } from './Button.js'
import { buttonVariants } from './Button.js'

const ChevronLeft = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn('size-6', className)}
    >
      <title>Previous page</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

const ChevronRight = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn('size-6', className)}
    >
      <title>Next page</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

const MoreHorizontal = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 6"
      className={cn('size-6', className)}
    >
      <title>More pages</title>
      <circle cx="6" cy="3" r="3" fill="currentColor" />
      <circle cx="12" cy="3" r="3" fill="currentColor" />
      <circle cx="18" cy="3" r="3" fill="currentColor" />
    </svg>
  )
}

export type PaginationProps = React.ComponentProps<'nav'>

const Pagination = ({ className, ...props }: PaginationProps) => (
  <nav
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)

function PaginationContent({
  className,
  ref,
  ...props
}: React.ComponentProps<'ul'> & { ref?: React.Ref<HTMLUListElement> }) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} ref={ref} {...props} />
}

function PaginationItem({
  className,
  ref,
  ...props
}: React.ComponentProps<'li'> & { ref?: React.Ref<HTMLLIElement> }) {
  return <li className={cn('', className)} ref={ref} {...props} />
}

export interface PaginationLinkProps
  extends Pick<ButtonProps, 'size'>,
    React.ComponentProps<'button'> {
  isActive?: boolean
}

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  disabled,
  ...props
}: PaginationLinkProps) => (
  <button
    aria-current={isActive ? 'page' : undefined}
    aria-disabled={disabled ? true : undefined}
    disabled={disabled}
    className={cn(
      buttonVariants({
        size,
        variant: isActive ? 'outline' : 'ghost',
      }),
      className,
    )}
    {...props}
  />
)

export type PaginationPreviousProps = React.ComponentProps<typeof PaginationLink>

const PaginationPrevious = ({ className, ...props }: PaginationPreviousProps) => (
  <PaginationLink
    aria-label="Go to previous page"
    className={cn('gap-1 pl-2.5', className)}
    size="default"
    {...props}
  >
    <ChevronLeft className="size-4" />
    <span>Previous</span>
  </PaginationLink>
)

export type PaginationNextProps = React.ComponentProps<typeof PaginationLink>

const PaginationNext = ({ className, ...props }: PaginationNextProps) => (
  <PaginationLink
    aria-label="Go to next page"
    className={cn('gap-1 pr-2.5', className)}
    size="default"
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="size-4" />
  </PaginationLink>
)

export type PaginationEllipsisProps = React.ComponentProps<'span'>

const PaginationEllipsis = ({ className, ...props }: PaginationEllipsisProps) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="size-4" />
    <span className="sr-only">More pages</span>
  </span>
)

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
