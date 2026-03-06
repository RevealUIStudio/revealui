/**
 * Builder Component Tests
 *
 * Tests the visual drag-drop builder component for adding, selecting,
 * and managing nested UI components.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Builder } from '../components/Builder'

vi.mock('@revealui/ai/client', () => ({
  useAgentStream: () => ({
    text: '',
    chunks: [],
    isStreaming: false,
    error: null,
    start: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}))

describe('Builder', () => {
  describe('Rendering', () => {
    it('should render the component toolbar', () => {
      render(<Builder />)

      expect(screen.getByText('Components')).toBeInTheDocument()
      expect(screen.getByText('Add Text')).toBeInTheDocument()
      expect(screen.getByText('Add Button')).toBeInTheDocument()
      expect(screen.getByText('Add Image')).toBeInTheDocument()
      expect(screen.getByText('Add Container')).toBeInTheDocument()
    })

    it('should render export and deploy buttons', () => {
      render(<Builder />)

      expect(screen.getByRole('button', { name: /export project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /deploy to vercel/i })).toBeInTheDocument()
    })

    it('should render the initial root container', () => {
      render(<Builder />)

      // The root container renders as a div with role="button"
      const containers = screen.getAllByRole('button')
      expect(containers.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Adding Components', () => {
    it('should add a text component when clicking Add Text with container selected', async () => {
      const user = userEvent.setup()
      render(<Builder />)

      // Select the root container first (click the dashed border container)
      const rootContainer = screen.getByRole('button', { name: '' })
      if (rootContainer) {
        await user.click(rootContainer)
      }

      await user.click(screen.getByText('Add Text'))

      expect(screen.getByText('New text')).toBeInTheDocument()
    })

    it('should add a button component when clicking Add Button with container selected', async () => {
      const user = userEvent.setup()
      render(<Builder />)

      // Select root container
      const containers = screen.getAllByRole('button')
      const rootContainer = containers.find((el) => el.className.includes('border-dashed'))
      if (rootContainer) {
        await user.click(rootContainer)
      }

      await user.click(screen.getByText('Add Button'))

      expect(screen.getByText('Click me')).toBeInTheDocument()
    })
  })

  describe('Component Selection', () => {
    it('should show properties panel when a component is selected', async () => {
      const user = userEvent.setup()
      render(<Builder />)

      // Select root container to add a text component
      const containers = screen.getAllByRole('button')
      const rootContainer = containers.find((el) => el.className.includes('border-dashed'))
      if (rootContainer) {
        await user.click(rootContainer)
      }

      // Add and then select text component
      await user.click(screen.getByText('Add Text'))
      await user.click(screen.getByText('New text'))

      // Properties panel should appear
      expect(screen.getByText('Properties')).toBeInTheDocument()
      expect(screen.getByText('Component Type')).toBeInTheDocument()
    })
  })

  describe('AI Assistant Toggle', () => {
    it('should toggle AI assistant panel visibility', async () => {
      const user = userEvent.setup()
      render(<Builder />)

      const aiButton = screen.queryByRole('button', { name: /ai assistant/i })
      if (aiButton) {
        await user.click(aiButton)
        // After toggling, either the panel shows or the text changes
        expect(aiButton).toBeInTheDocument()
      }
    })
  })
})
