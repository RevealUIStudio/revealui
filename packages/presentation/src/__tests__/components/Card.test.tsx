/**
 * Card Component Tests
 *
 * Tests for the Card display components
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/Card.js'

describe('Card', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<Card />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render children', () => {
      render(
        <Card>
          <div>Card content</div>
        </Card>,
      )

      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<Card className="custom-card" />)

      expect(container.firstChild).toHaveClass('custom-card')
    })

    it('should have default styling classes', () => {
      const { container } = render(<Card />)

      const card = container.firstChild
      expect(card).toHaveClass('rounded-lg')
      expect(card).toHaveClass('border')
      expect(card).toHaveClass('bg-card')
      expect(card).toHaveClass('shadow-sm')
    })

    it('should accept HTML div props', () => {
      const { container } = render(<Card data-testid="test-card" id="card-1" />)

      const card = container.firstChild
      expect(card).toHaveAttribute('data-testid', 'test-card')
      expect(card).toHaveAttribute('id', 'card-1')
    })
  })

  describe('Composition', () => {
    it('should render complete card with all sub-components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>Card content</CardContent>
          <CardFooter>Card footer</CardFooter>
        </Card>,
      )

      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card description')).toBeInTheDocument()
      expect(screen.getByText('Card content')).toBeInTheDocument()
      expect(screen.getByText('Card footer')).toBeInTheDocument()
    })

    it('should work with minimal composition', () => {
      render(
        <Card>
          <CardContent>Simple content</CardContent>
        </Card>,
      )

      expect(screen.getByText('Simple content')).toBeInTheDocument()
    })

    it('should render multiple cards independently', () => {
      render(
        <>
          <Card>
            <CardContent>First card</CardContent>
          </Card>
          <Card>
            <CardContent>Second card</CardContent>
          </Card>
        </>,
      )

      expect(screen.getByText('First card')).toBeInTheDocument()
      expect(screen.getByText('Second card')).toBeInTheDocument()
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to div element', () => {
      const ref = { current: null as HTMLDivElement | null }

      render(<Card ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('should allow ref access to element', () => {
      const ref = { current: null as HTMLDivElement | null }

      render(<Card ref={ref}>Content</Card>)

      expect(ref.current?.tagName).toBe('DIV')
      expect(ref.current?.textContent).toBe('Content')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty card', () => {
      const { container } = render(<Card />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(1000)

      render(
        <Card>
          <CardContent>{longContent}</CardContent>
        </Card>,
      )

      expect(screen.getByText(longContent)).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(
        <Card>
          {null}
          <CardContent>Visible content</CardContent>
        </Card>,
      )

      expect(screen.getByText('Visible content')).toBeInTheDocument()
    })
  })
})

describe('CardHeader', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<CardHeader />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render children', () => {
      render(<CardHeader>Header content</CardHeader>)

      expect(screen.getByText('Header content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<CardHeader className="custom-header" />)

      expect(container.firstChild).toHaveClass('custom-header')
    })

    it('should have default styling classes', () => {
      const { container } = render(<CardHeader />)

      const header = container.firstChild
      expect(header).toHaveClass('flex')
      expect(header).toHaveClass('flex-col')
      expect(header).toHaveClass('p-6')
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to div element', () => {
      const ref = { current: null as HTMLDivElement | null }

      render(<CardHeader ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })
})

describe('CardTitle', () => {
  describe('Rendering', () => {
    it('should render as h3 element', () => {
      render(<CardTitle>Title</CardTitle>)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent('Title')
    })

    it('should apply custom className', () => {
      const { container } = render(<CardTitle className="custom-title" />)

      const title = container.querySelector('h3')
      expect(title).toHaveClass('custom-title')
    })

    it('should have default styling classes', () => {
      const { container } = render(<CardTitle />)

      const title = container.querySelector('h3')
      expect(title).toHaveClass('text-2xl')
      expect(title).toHaveClass('font-semibold')
      expect(title).toHaveClass('leading-none')
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading level', () => {
      render(<CardTitle>Test Title</CardTitle>)

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    })

    it('should be part of heading hierarchy', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Main Title</CardTitle>
          </CardHeader>
        </Card>,
      )

      const headings = screen.getAllByRole('heading')
      expect(headings).toHaveLength(1)
      expect(headings[0]).toHaveTextContent('Main Title')
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to h3 element', () => {
      const ref = { current: null as HTMLHeadingElement | null }

      render(<CardTitle ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
      expect(ref.current?.tagName).toBe('H3')
    })
  })
})

describe('CardDescription', () => {
  describe('Rendering', () => {
    it('should render as paragraph', () => {
      render(<CardDescription>Description text</CardDescription>)

      expect(screen.getByText('Description text')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<CardDescription className="custom-description" />)

      const description = container.querySelector('p')
      expect(description).toHaveClass('custom-description')
    })

    it('should have default styling classes', () => {
      const { container } = render(<CardDescription />)

      const description = container.querySelector('p')
      expect(description).toHaveClass('text-sm')
      expect(description).toHaveClass('text-muted-foreground')
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to p element', () => {
      const ref = { current: null as HTMLParagraphElement | null }

      render(<CardDescription ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLParagraphElement)
    })
  })
})

describe('CardContent', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<CardContent />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render children', () => {
      render(<CardContent>Content text</CardContent>)

      expect(screen.getByText('Content text')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<CardContent className="custom-content" />)

      expect(container.firstChild).toHaveClass('custom-content')
    })

    it('should have default styling classes', () => {
      const { container } = render(<CardContent />)

      const content = container.firstChild
      expect(content).toHaveClass('p-6')
      expect(content).toHaveClass('pt-0')
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to div element', () => {
      const ref = { current: null as HTMLDivElement | null }

      render(<CardContent ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })
})

describe('CardFooter', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<CardFooter />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render children', () => {
      render(<CardFooter>Footer content</CardFooter>)

      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<CardFooter className="custom-footer" />)

      expect(container.firstChild).toHaveClass('custom-footer')
    })

    it('should have default styling classes', () => {
      const { container } = render(<CardFooter />)

      const footer = container.firstChild
      expect(footer).toHaveClass('flex')
      expect(footer).toHaveClass('items-center')
      expect(footer).toHaveClass('p-6')
      expect(footer).toHaveClass('pt-0')
    })
  })

  describe('Common Use Cases', () => {
    it('should render action buttons', () => {
      render(
        <CardFooter>
          <button type="button">Cancel</button>
          <button type="button">Save</button>
        </CardFooter>,
      )

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    })

    it('should render links', () => {
      render(
        <CardFooter>
          <a href="/learn-more">Learn more</a>
        </CardFooter>,
      )

      expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument()
    })
  })

  describe('Forwarded Ref', () => {
    it('should forward ref to div element', () => {
      const ref = { current: null as HTMLDivElement | null }

      render(<CardFooter ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })
})
