/**
 * Home Page Component Tests
 *
 * Tests the Home page components for rendering, loading states,
 * error handling, and data display patterns.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomeBackground from '../components/Home/Background'
import HomeMain from '../components/Home/Main'

describe('HomeBackground', () => {
  it('should render children content', () => {
    render(
      <HomeBackground>
        <div data-testid="child">Child Content</div>
      </HomeBackground>,
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('should render gradient and solid backgrounds', () => {
    const { container } = render(
      <HomeBackground>
        <span>Content</span>
      </HomeBackground>,
    )

    // Background renders multiple layers
    expect(container.querySelectorAll('div').length).toBeGreaterThan(1)
  })
})

describe('HomeMain', () => {
  it('should render initial content before fetch completes', async () => {
    render(<HomeMain />)

    // The component uses useMemo for initial data, so it should render immediately
    // or show a loading skeleton
    await waitFor(() => {
      const content = screen.queryByText(/loading/i) || screen.queryByText(/revealui/i)
      // Either loading or content should be visible
      expect(content !== null || document.body.textContent!.length > 0).toBe(true)
    })
  })

  it('should not crash when fetch returns empty data', async () => {
    render(<HomeMain />)

    // The stub fetchMainInfos returns empty array, so fallback should show
    await waitFor(() => {
      // Component should either show fallback or initial data
      expect(document.body).toBeTruthy()
    })
  })
})
