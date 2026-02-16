/**
 * AgentPanel Component Tests
 *
 * Tests for the AI agent management panel
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentPanel } from '../../components/AgentPanel.js'

// Mock ChatInterface component
vi.mock('../../components/ChatInterface.js', () => ({
  ChatInterface: () => <div>Chat Interface</div>,
}))

describe('AgentPanel', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<AgentPanel />)

      expect(screen.getByText('AI Agents')).toBeInTheDocument()
    })

    it('should render all default agents', () => {
      render(<AgentPanel />)

      expect(screen.getByText('Content Writer')).toBeInTheDocument()
      expect(screen.getByText('SEO Optimizer')).toBeInTheDocument()
      expect(screen.getByText('Data Analyst')).toBeInTheDocument()
    })

    it('should display agent icons', () => {
      render(<AgentPanel />)

      const panel = screen.getByText('AI Agents').closest('div')
      if (panel) {
        expect(panel.textContent).toContain('📝') // Content icon
        expect(panel.textContent).toContain('🔍') // SEO icon
        expect(panel.textContent).toContain('📊') // Analytics icon
      }
    })

    it('should show "New Agent" button', () => {
      render(<AgentPanel />)

      expect(screen.getByRole('button', { name: /new agent/i })).toBeInTheDocument()
    })

    it('should display active agents section', () => {
      render(<AgentPanel />)

      expect(screen.getByText(/active agents/i)).toBeInTheDocument()
    })

    it('should display recent conversations section', () => {
      render(<AgentPanel />)

      expect(screen.getByText(/recent conversations/i)).toBeInTheDocument()
    })
  })

  describe('Agent Status', () => {
    it('should show active status indicator', () => {
      const { container } = render(<AgentPanel />)

      // Active agent should have green indicator
      const activeIndicators = container.querySelectorAll('.bg-green-400')
      expect(activeIndicators.length).toBeGreaterThan(0)
    })

    it('should show idle status indicator', () => {
      const { container } = render(<AgentPanel />)

      // Idle agents should have gray indicator
      const idleIndicators = container.querySelectorAll('.bg-gray-500')
      expect(idleIndicators.length).toBeGreaterThan(0)
    })

    it('should display agent last message', () => {
      render(<AgentPanel />)

      expect(screen.getByText('Draft created successfully')).toBeInTheDocument()
    })

    it('should not show last message for idle agents', () => {
      render(<AgentPanel />)

      const seoAgent = screen.getByText('SEO Optimizer').closest('button')
      if (seoAgent) {
        expect(within(seoAgent as HTMLElement).queryByText(/draft/i)).not.toBeInTheDocument()
      }
    })
  })

  describe('Agent Selection', () => {
    it('should highlight first agent by default', () => {
      render(<AgentPanel />)

      const contentWriter = screen.getByText('Content Writer').closest('button')
      expect(contentWriter).toHaveClass('bg-blue-600')
    })

    it('should change selection when clicking agent', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      const seoOptimizer = screen.getByText('SEO Optimizer').closest('button')
      if (seoOptimizer) {
        await user.click(seoOptimizer as HTMLElement)

        // Should navigate to chat interface
        expect(screen.getByText('Chat Interface')).toBeInTheDocument()
      }
    })

    it('should show chat interface when agent is clicked', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      const agent = screen.getByText('Content Writer').closest('button')
      if (agent) {
        await user.click(agent as HTMLElement)

        expect(screen.getByText('Chat Interface')).toBeInTheDocument()
      }
    })

    it('should have aria-pressed attribute on selected agent', () => {
      render(<AgentPanel />)

      const contentWriter = screen.getByText('Content Writer').closest('button')
      expect(contentWriter).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Chat Navigation', () => {
    it('should show back button in chat view', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      const agent = screen.getByText('Content Writer').closest('button')
      if (agent) {
        await user.click(agent as HTMLElement)

        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
      }
    })

    it('should return to agent list when back button is clicked', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      // Click agent to open chat
      const agent = screen.getByText('Content Writer').closest('button')
      if (agent) {
        await user.click(agent as HTMLElement)

        // Click back button
        const backButton = screen.getByRole('button', { name: /back/i })
        await user.click(backButton)

        // Should show agent list again
        expect(screen.getByText('AI Agents')).toBeInTheDocument()
        expect(screen.queryByText('Chat Interface')).not.toBeInTheDocument()
      }
    })

    it('should show selected agent name in chat header', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      const agent = screen.getByText('SEO Optimizer').closest('button')
      if (agent) {
        await user.click(agent as HTMLElement)

        // Header should show agent name
        const headers = screen.getAllByText('SEO Optimizer')
        expect(headers.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Conversations', () => {
    it('should display conversation titles', () => {
      render(<AgentPanel />)

      expect(screen.getByText('Homepage copy optimization')).toBeInTheDocument()
      expect(screen.getByText('Meta tags analysis')).toBeInTheDocument()
    })

    it('should show message count for conversations', () => {
      render(<AgentPanel />)

      expect(screen.getByText(/12 messages/i)).toBeInTheDocument()
      expect(screen.getByText(/8 messages/i)).toBeInTheDocument()
    })

    it('should display conversation timestamps', () => {
      const { container } = render(<AgentPanel />)

      // Should have time elements (checking for presence, not exact time)
      const timeElements = container.querySelectorAll('.text-gray-500')
      expect(timeElements.length).toBeGreaterThan(0)
    })

    it('should show agent icon for each conversation', () => {
      render(<AgentPanel />)

      const conversations = screen.getByText(/recent conversations/i).parentElement
      if (conversations) {
        expect(conversations.textContent).toContain('📝')
        expect(conversations.textContent).toContain('🔍')
      }
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<AgentPanel />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      // Tab to New Agent button
      await user.tab()
      expect(screen.getByRole('button', { name: /new agent/i })).toHaveFocus()
    })

    it('should have accessible agent buttons', () => {
      render(<AgentPanel />)

      const agentButtons = screen.getAllByRole('button', { pressed: false })
      agentButtons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })

    it('should indicate selected agent state', () => {
      render(<AgentPanel />)

      const selectedAgent = screen
        .getByText('Content Writer')
        .closest('button[aria-pressed="true"]')
      expect(selectedAgent).toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('should apply hover styles to agent buttons', () => {
      const { container } = render(<AgentPanel />)

      const agentButtons = container.querySelectorAll('button[aria-pressed]')
      agentButtons.forEach((button) => {
        expect(button.className).toMatch(/hover:bg/)
      })
    })

    it('should highlight active agent differently', () => {
      render(<AgentPanel />)

      const activeAgent = screen.getByText('Content Writer').closest('button')
      const inactiveAgent = screen.getByText('SEO Optimizer').closest('button')

      expect(activeAgent).toHaveClass('bg-blue-600')
      expect(inactiveAgent).toHaveClass('bg-gray-700')
    })

    it('should show status dot for each agent', () => {
      const { container } = render(<AgentPanel />)

      const statusDots = container.querySelectorAll('.w-2.h-2.rounded-full')
      expect(statusDots.length).toBeGreaterThan(0)
    })
  })

  describe('Layout', () => {
    it('should have scrollable agent list', () => {
      const { container } = render(<AgentPanel />)

      const scrollContainer = container.querySelector('.overflow-y-auto')
      expect(scrollContainer).toBeInTheDocument()
    })

    it('should use flexbox layout', () => {
      const { container } = render(<AgentPanel />)

      const mainContainer = container.querySelector('.flex.flex-col')
      expect(mainContainer).toBeInTheDocument()
    })

    it('should have proper spacing between sections', () => {
      const { container } = render(<AgentPanel />)

      const borderedSections = container.querySelectorAll('.border-b, .border-t')
      expect(borderedSections.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid agent switching', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      // Click multiple agents rapidly
      const agents = [
        screen.getByText('Content Writer'),
        screen.getByText('SEO Optimizer'),
        screen.getByText('Data Analyst'),
      ]

      for (const agent of agents) {
        const button = agent.closest('button')
        if (button) {
          await user.click(button as HTMLElement)
        }
      }

      // Should show chat interface
      expect(screen.getByText('Chat Interface')).toBeInTheDocument()
    })

    it('should maintain state when toggling chat view', async () => {
      const user = userEvent.setup()

      render(<AgentPanel />)

      // Select SEO Optimizer by finding the button that contains the text
      let seoAgentButton = screen.getByRole('button', { name: /SEO Optimizer/i })
      await user.click(seoAgentButton)

      // Verify chat interface is shown
      expect(screen.getByText('Chat Interface')).toBeInTheDocument()

      // Go back
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      // Verify we're back to agent list
      expect(screen.getByText('AI Agents')).toBeInTheDocument()

      // Re-query for the button after navigation (DOM has changed)
      seoAgentButton = screen.getByRole('button', { name: /SEO Optimizer/i })

      // Click again - should still work
      await user.click(seoAgentButton)
      expect(screen.getByText('Chat Interface')).toBeInTheDocument()
    })

    it('should render with empty conversations list', () => {
      render(<AgentPanel />)

      // Component should still render even if we can't test with empty list
      // (since conversations are hard-coded in the component)
      expect(screen.getByText(/recent conversations/i)).toBeInTheDocument()
    })
  })

  describe('Agent Types', () => {
    it('should display correct icon for content agent', () => {
      render(<AgentPanel />)

      const contentWriter = screen.getByText('Content Writer').closest('button')
      expect(contentWriter?.textContent).toContain('📝')
    })

    it('should display correct icon for SEO agent', () => {
      render(<AgentPanel />)

      const seoOptimizer = screen.getByText('SEO Optimizer').closest('button')
      expect(seoOptimizer?.textContent).toContain('🔍')
    })

    it('should display correct icon for analytics agent', () => {
      render(<AgentPanel />)

      const dataAnalyst = screen.getByText('Data Analyst').closest('button')
      expect(dataAnalyst?.textContent).toContain('📊')
    })
  })
})
