#!/usr/bin/env tsx

/**
 * Tests for validate-root-markdown.ts
 */

import {describe,expect,it} from 'vitest'

import {determineTargetSubfolder} from '../validate-root-markdown.ts'

describe('determineTargetSubfolder', () => {
  describe('Assessment files', () => {
    it('should categorize assessment files correctly', () => {
      expect(determineTargetSubfolder('BRUTAL_AGENT_ASSESSMENT.md')).toBe('docs/assessments')
      expect(determineTargetSubfolder('assessment.md')).toBe('docs/assessments')
      expect(determineTargetSubfolder('cohesion_analysis.md')).toBe('docs/assessments')
      expect(determineTargetSubfolder('DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md')).toBe(
        'docs/assessments',
      )
    })

    it('should prioritize assessments over agent files', () => {
      // Even though it contains "agent", assessment pattern comes first
      expect(determineTargetSubfolder('BRUTAL_AGENT_ASSESSMENT.md')).toBe('docs/assessments')
    })
  })

  describe('Agent files', () => {
    it('should categorize agent handoff files correctly', () => {
      expect(determineTargetSubfolder('AGENT_HANDOFF.md')).toBe('docs/agent')
      expect(determineTargetSubfolder('PROMPT_FOR_NEXT_AGENT.md')).toBe('docs/agent')
      expect(determineTargetSubfolder('agent.md')).toBe('docs/agent')
    })

    it('should not categorize assessments as agent files', () => {
      expect(determineTargetSubfolder('BRUTAL_AGENT_ASSESSMENT.md')).not.toBe('docs/agent')
    })
  })

  describe('Development files', () => {
    it('should categorize development docs correctly', () => {
      expect(determineTargetSubfolder('CODE-STYLE-GUIDELINES.md')).toBe('docs/development')
      expect(determineTargetSubfolder('development.md')).toBe('docs/development')
      expect(determineTargetSubfolder('technical.md')).toBe('docs/development')
    })

    it('should prioritize development over guides', () => {
      expect(determineTargetSubfolder('CODE-STYLE-GUIDELINES.md')).toBe('docs/development')
      expect(determineTargetSubfolder('CODE-STYLE-GUIDELINES.md')).not.toBe('docs/guides')
    })
  })

  describe('Guide files', () => {
    it('should categorize guide files correctly', () => {
      expect(determineTargetSubfolder('BLOG-CREATION-GUIDE.md')).toBe('docs/guides')
      expect(determineTargetSubfolder('QUICK_START.md')).toBe('docs/guides')
      expect(determineTargetSubfolder('CMS-CONTENT-EXAMPLES.md')).toBe('docs/guides')
      expect(determineTargetSubfolder('CMS-CONTENT-RECOMMENDATIONS.md')).toBe('docs/guides')
    })
  })

  describe('Migration files', () => {
    it('should categorize migration files correctly', () => {
      expect(determineTargetSubfolder('BREAKING-CHANGES-CRDT.md')).toBe('docs/migrations')
      expect(determineTargetSubfolder('DEPRECATED-TYPES-REMOVAL.md')).toBe('docs/migrations')
      expect(determineTargetSubfolder('MODERNIZATION-VERIFICATION.md')).toBe('docs/migrations')
    })
  })

  describe('Reference files', () => {
    it('should categorize reference files correctly', () => {
      expect(determineTargetSubfolder('COMPONENT-MAPPING.md')).toBe('docs/reference')
      expect(determineTargetSubfolder('DEPENDENCIES-LIST.md')).toBe('docs/reference')
      expect(determineTargetSubfolder('FRAMEWORKS-LIST.md')).toBe('docs/reference')
    })
  })

  describe('Planning files', () => {
    it('should categorize planning files correctly', () => {
      expect(determineTargetSubfolder('PRIORITIZED_ACTION_PLAN.md')).toBe('docs/planning')
      expect(determineTargetSubfolder('RALPH_COHESION_ENGINE_RESEARCH.md')).toBe('docs/planning')
      expect(determineTargetSubfolder('UNFINISHED_WORK_INVENTORY.md')).toBe('docs/planning')
    })
  })

  describe('Legal files', () => {
    it('should categorize legal files correctly', () => {
      expect(determineTargetSubfolder('THIRD_PARTY_LICENSES.md')).toBe('docs/legal')
      expect(determineTargetSubfolder('LICENSE.md')).toBe('docs/legal')
    })
  })

  describe('Documentation management files', () => {
    it('should categorize documentation management files correctly', () => {
      expect(determineTargetSubfolder('DOCUMENTATION_INDEX.md')).toBe('docs')
      expect(determineTargetSubfolder('DOCUMENTATION_STRATEGY.md')).toBe('docs')
      expect(determineTargetSubfolder('ROOT_MARKDOWN_POLICY.md')).toBe('docs')
    })
  })

  describe('Edge cases', () => {
    it('should default to docs/ for unknown files', () => {
      expect(determineTargetSubfolder('RANDOM_FILE.md')).toBe('docs')
      expect(determineTargetSubfolder('unknown.md')).toBe('docs')
    })

    it('should handle case-insensitive matching', () => {
      expect(determineTargetSubfolder('assessment.md')).toBe('docs/assessments')
      expect(determineTargetSubfolder('ASSESSMENT.md')).toBe('docs/assessments')
      expect(determineTargetSubfolder('Assessment.md')).toBe('docs/assessments')
    })

    it('should handle files with underscores and hyphens', () => {
      expect(determineTargetSubfolder('agent-handoff.md')).toBe('docs/agent')
      expect(determineTargetSubfolder('agent_handoff.md')).toBe('docs/agent')
    })
  })
})
