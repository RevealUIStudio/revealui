/**
 * Pagination Component Tests
 *
 * Tests for the Pagination component system including navigation,
 * active state, ellipsis, and click handlers.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../../components/Pagination.js'

describe('Pagination', () => {
  it('should render as a nav element', () => {
    render(<Pagination />)

    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
  })

  it('should have aria-label "pagination"', () => {
    render(<Pagination />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'pagination')
  })

  it('should apply custom className', () => {
    render(<Pagination className="custom-pagination" />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-pagination')
  })
})

describe('PaginationContent', () => {
  it('should render as a ul element', () => {
    render(
      <PaginationContent>
        <li>Item</li>
      </PaginationContent>,
    )

    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
    expect(list.tagName).toBe('UL')
  })
})

describe('PaginationItem', () => {
  it('should render as a li element', () => {
    render(
      <ul>
        <PaginationItem data-testid="item">Page 1</PaginationItem>
      </ul>,
    )

    const item = screen.getByTestId('item')
    expect(item.tagName).toBe('LI')
  })
})

describe('PaginationLink', () => {
  it('should render as a button element', () => {
    render(<PaginationLink>1</PaginationLink>)

    const link = screen.getByRole('button', { name: '1' })
    expect(link).toBeInTheDocument()
  })

  it('should set aria-current="page" when active', () => {
    render(<PaginationLink isActive>1</PaginationLink>)

    const link = screen.getByRole('button', { name: '1' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('should not set aria-current when not active', () => {
    render(<PaginationLink>1</PaginationLink>)

    const link = screen.getByRole('button', { name: '1' })
    expect(link).not.toHaveAttribute('aria-current')
  })

  it('should call onClick handler when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<PaginationLink onClick={handleClick}>1</PaginationLink>)

    const link = screen.getByRole('button', { name: '1' })
    await user.click(link)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

describe('PaginationPrevious', () => {
  it('should render with "Previous" text', () => {
    render(<PaginationPrevious />)

    expect(screen.getByText('Previous')).toBeInTheDocument()
  })

  it('should have aria-label for previous page', () => {
    render(<PaginationPrevious />)

    const button = screen.getByRole('button', { name: /previous/i })
    expect(button).toHaveAttribute('aria-label', 'Go to previous page')
  })

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<PaginationPrevious onClick={handleClick} />)

    const button = screen.getByRole('button', { name: /previous/i })
    await user.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

describe('PaginationNext', () => {
  it('should render with "Next" text', () => {
    render(<PaginationNext />)

    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('should have aria-label for next page', () => {
    render(<PaginationNext />)

    const button = screen.getByRole('button', { name: /next/i })
    expect(button).toHaveAttribute('aria-label', 'Go to next page')
  })

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<PaginationNext onClick={handleClick} />)

    const button = screen.getByRole('button', { name: /next/i })
    await user.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

describe('PaginationEllipsis', () => {
  it('should render with aria-hidden', () => {
    render(<PaginationEllipsis data-testid="ellipsis" />)

    const ellipsis = screen.getByTestId('ellipsis')
    expect(ellipsis).toHaveAttribute('aria-hidden')
  })

  it('should contain "More pages" screen reader text', () => {
    render(<PaginationEllipsis />)

    const srOnly = screen.getAllByText('More pages')
    expect(srOnly.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Full Pagination composition', () => {
  it('should render a complete pagination with all subcomponents', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink isActive>2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink>3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    )

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
    const srOnly = screen.getAllByText('More pages')
    expect(srOnly.length).toBeGreaterThanOrEqual(1)
  })
})
