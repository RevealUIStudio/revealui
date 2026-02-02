/**
 * DashboardLayout Component Tests
 *
 * Tests for the main dashboard layout component
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardLayout } from '../../components/DashboardLayout'

describe('DashboardLayout', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(
        <DashboardLayout>
          <div>Test content</div>
        </DashboardLayout>,
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should render children correctly', () => {
      const { container } = render(
        <DashboardLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </DashboardLayout>,
      )

      expect(screen.getByTestId('child-1')).toBeInTheDocument()
      expect(screen.getByTestId('child-2')).toBeInTheDocument()
    })

    it('should have main content area', () => {
      const { container } = render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()
    })

    it('should apply custom className if provided', () => {
      const { container } = render(
        <DashboardLayout className="custom-class">
          <div>Content</div>
        </DashboardLayout>,
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Navigation', () => {
    it('should render navigation menu', () => {
      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      // Navigation should be present
      const nav = screen.queryByRole('navigation')
      expect(nav).toBeTruthy()
    })

    it('should render navigation links', () => {
      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      // Common dashboard nav items
      const links = screen.queryAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
    })
  })

  describe('Header', () => {
    it('should render header section', () => {
      const { container } = render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      const header = container.querySelector('header')
      expect(header).toBeTruthy()
    })

    it('should render dashboard title', () => {
      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      const heading = screen.queryByRole('heading', { level: 1 })
      expect(heading).toBeTruthy()
    })
  })

  describe('Sidebar', () => {
    it('should render sidebar if enabled', () => {
      const { container } = render(
        <DashboardLayout showSidebar={true}>
          <div>Content</div>
        </DashboardLayout>,
      )

      const sidebar = container.querySelector('aside')
      expect(sidebar).toBeTruthy()
    })

    it('should not render sidebar if disabled', () => {
      const { container } = render(
        <DashboardLayout showSidebar={false}>
          <div>Content</div>
        </DashboardLayout>,
      )

      const sidebar = container.querySelector('aside')
      expect(sidebar).toBeFalsy()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA landmarks', () => {
      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      expect(screen.queryByRole('navigation')).toBeTruthy()
      expect(screen.queryByRole('main')).toBeTruthy()
    })

    it('should be keyboard navigable', () => {
      const { container } = render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      const links = screen.queryAllByRole('link')
      links.forEach((link) => {
        expect(link).not.toHaveAttribute('tabindex', '-1')
      })
    })

    it('should have descriptive labels', () => {
      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      const nav = screen.queryByRole('navigation')
      if (nav) {
        expect(nav).toHaveAttribute('aria-label')
      }
    })
  })

  describe('Responsive Behavior', () => {
    it('should render on mobile viewport', () => {
      // Set viewport to mobile size
      global.innerWidth = 375
      global.innerHeight = 667

      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should render on tablet viewport', () => {
      // Set viewport to tablet size
      global.innerWidth = 768
      global.innerHeight = 1024

      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should render on desktop viewport', () => {
      // Set viewport to desktop size
      global.innerWidth = 1920
      global.innerHeight = 1080

      render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>,
      )

      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle no children gracefully', () => {
      render(<DashboardLayout />)

      const main = screen.queryByRole('main')
      expect(main).toBeTruthy()
    })

    it('should handle very long content', () => {
      const longContent = 'Lorem ipsum '.repeat(1000)

      render(
        <DashboardLayout>
          <div>{longContent}</div>
        </DashboardLayout>,
      )

      expect(screen.getByText(/Lorem ipsum/)).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(
        <DashboardLayout>
          {null}
          <div>Visible content</div>
        </DashboardLayout>,
      )

      expect(screen.getByText('Visible content')).toBeInTheDocument()
    })
  })
})
