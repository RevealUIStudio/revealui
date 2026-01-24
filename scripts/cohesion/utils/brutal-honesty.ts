/**
 * Brutal Honesty Enforcement and Validation
 * Built-in system to ensure assessments are brutally honest by default
 */

import type { CohesionAnalysis } from '../types.js'

/**
 * Brutal honesty criteria checklist
 */
export interface BrutalHonestyCriteria {
  usesBluntLanguage: boolean // Uses "painful", "frustrating", "broken" not "needs improvement"
  includesQuantitativeEvidence: boolean // Has concrete numbers, not just "some" or "many"
  includesCodeExamples: boolean // Shows actual file:line references
  identifiesRootCauses: boolean // Explains WHY not just WHAT
  avoidsEuphemisms: boolean // Doesn't sugarcoat issues
  includesSeverity: boolean // Uses CRITICAL/HIGH/MEDIUM not just "issues"
  providesHonestGrade: boolean // Gives realistic grade, not inflated
  hasWouldIUseThis: boolean // Includes honest "would I use this" assessment
}

/**
 * Brutal honesty enforcement rules
 */
export const BRUTAL_HONESTY_RULES = {
  // Language patterns that indicate brutal honesty
  bluntLanguagePatterns: [
    /painful|frustrating|broken|terrible|awful|horrible/i,
    /doesn't work|failed|failed miserably|completely broken/i,
    /would not use|would not recommend|would avoid/i,
    /not acceptable|unacceptable|should be ashamed/i,
  ],

  // Language patterns to avoid (euphemisms)
  euphemismPatterns: [
    /could be improved|needs improvement|room for growth/i,
    /great opportunity|exciting challenges|learning experience/i,
    /minor issues|small problems|easy fixes/i,
  ],

  // Required phrases for brutal honesty
  requiredPhrases: [
    /bottom line|bottom line is|the truth is/i,
    /would i use this|would i recommend this/i,
    /the reality is|honestly|frankly/i,
  ],
}

/**
 * Validate assessment text for brutal honesty
 */
export function validateBrutalHonesty(assessmentText: string): {
  valid: boolean
  score: number
  criteria: BrutalHonestyCriteria
  violations: string[]
  suggestions: string[]
} {
  const criteria: BrutalHonestyCriteria = {
    usesBluntLanguage: false,
    includesQuantitativeEvidence: false,
    includesCodeExamples: false,
    identifiesRootCauses: false,
    avoidsEuphemisms: true, // Start as true, set false if euphemisms found
    includesSeverity: false,
    providesHonestGrade: false,
    hasWouldIUseThis: false,
  }

  const violations: string[] = []
  const suggestions: string[] = []

  // Check for blunt language
  const hasBluntLanguage = BRUTAL_HONESTY_RULES.bluntLanguagePatterns.some((pattern) =>
    pattern.test(assessmentText),
  )
  criteria.usesBluntLanguage = hasBluntLanguage
  if (!hasBluntLanguage) {
    violations.push('Missing blunt, honest language')
    suggestions.push('Use words like "painful", "frustrating", "broken" instead of euphemisms')
  }

  // Check for euphemisms
  const hasEuphemisms = BRUTAL_HONESTY_RULES.euphemismPatterns.some((pattern) =>
    pattern.test(assessmentText),
  )
  criteria.avoidsEuphemisms = !hasEuphemisms
  if (hasEuphemisms) {
    violations.push('Contains euphemistic language')
    suggestions.push('Replace soft language with direct, honest assessments')
  }

  // Check for quantitative evidence
  const hasQuantitative = /(\d+)\s+(files|instances|issues|lines|percent|%)/i.test(assessmentText)
  criteria.includesQuantitativeEvidence = hasQuantitative
  if (!hasQuantitative) {
    violations.push('Missing quantitative evidence')
    suggestions.push('Include specific numbers (file counts, percentages, line numbers)')
  }

  // Check for code examples with file:line references
  const hasCodeExamples =
    /```\d+:\d+:[^\n]+/i.test(assessmentText) || /`[^`]+:\d+`/i.test(assessmentText)
  criteria.includesCodeExamples = hasCodeExamples
  if (!hasCodeExamples) {
    violations.push('Missing code examples with file:line references')
    suggestions.push('Include file:line code references for all issues')
  }

  // Check for severity ratings
  const hasSeverity = /(CRITICAL|HIGH|MEDIUM|LOW)\s+(severity|priority|issue)/i.test(assessmentText)
  criteria.includesSeverity = hasSeverity
  if (!hasSeverity) {
    violations.push('Missing severity ratings')
    suggestions.push('Use CRITICAL/HIGH/MEDIUM/LOW severity ratings')
  }

  // Check for grade
  const hasGrade = /(Grade|Overall Grade|Assessment Grade):\s*[A-F][+-]?|(D\+|C-|B\+|A-)/i.test(
    assessmentText,
  )
  criteria.providesHonestGrade = hasGrade
  if (!hasGrade) {
    violations.push('Missing honest grade assessment')
    suggestions.push('Include overall grade (D+, C-, etc.)')
  }

  // Check for "would I use this" section
  const hasWouldIUse = /would i (use|recommend|choose)|would you use/i.test(assessmentText)
  criteria.hasWouldIUseThis = hasWouldIUse
  if (!hasWouldIUse) {
    violations.push('Missing "Would I Use This" assessment')
    suggestions.push('Include honest assessment of whether you would use this in production')
  }

  // Check for root cause identification
  const hasRootCause = /(root cause|why|because|the problem is|the issue is)/i.test(assessmentText)
  criteria.identifiesRootCauses = hasRootCause
  if (!hasRootCause) {
    violations.push('Missing root cause analysis')
    suggestions.push('Explain WHY issues exist, not just WHAT they are')
  }

  // Check for required phrases
  const hasRequiredPhrases = BRUTAL_HONESTY_RULES.requiredPhrases.some((pattern) =>
    pattern.test(assessmentText),
  )
  if (!hasRequiredPhrases) {
    violations.push('Missing required brutal honesty phrases')
    suggestions.push('Include phrases like "Bottom line", "The truth is", "Would I use this"')
  }

  // Calculate score (0-100)
  const score = calculateBrutalHonestyScore(criteria)

  // Determine if valid (at least 7/8 criteria met and score >= 70)
  const valid = Object.values(criteria).filter((v) => v === true).length >= 6 && score >= 70

  return {
    valid,
    score,
    criteria,
    violations,
    suggestions,
  }
}

/**
 * Calculate brutal honesty score (0-100)
 */
function calculateBrutalHonestyScore(criteria: BrutalHonestyCriteria): number {
  const weights = {
    usesBluntLanguage: 15,
    includesQuantitativeEvidence: 15,
    includesCodeExamples: 15,
    identifiesRootCauses: 10,
    avoidsEuphemisms: 15, // Negative weight - penalizes euphemisms
    includesSeverity: 10,
    providesHonestGrade: 10,
    hasWouldIUseThis: 10,
  }

  let score = 0

  if (criteria.usesBluntLanguage) score += weights.usesBluntLanguage
  if (criteria.includesQuantitativeEvidence) score += weights.includesQuantitativeEvidence
  if (criteria.includesCodeExamples) score += weights.includesCodeExamples
  if (criteria.identifiesRootCauses) score += weights.identifiesRootCauses
  if (criteria.avoidsEuphemisms) score += weights.avoidsEuphemisms
  if (criteria.includesSeverity) score += weights.includesSeverity
  if (criteria.providesHonestGrade) score += weights.providesHonestGrade
  if (criteria.hasWouldIUseThis) score += weights.hasWouldIUseThis

  return Math.min(100, score)
}

/**
 * Enhance assessment text with brutal honesty if needed
 */
export function enhanceWithBrutalHonesty(assessmentText: string): {
  enhanced: string
  changes: string[]
} {
  const validation = validateBrutalHonesty(assessmentText)
  let enhanced = assessmentText
  const changes: string[] = []

  // If already valid, return as-is
  if (validation.valid) {
    return {
      enhanced,
      changes: ['Assessment already meets brutal honesty standards'],
    }
  }

  // Add missing required phrases if not present
  if (!BRUTAL_HONESTY_RULES.requiredPhrases.some((p) => p.test(enhanced))) {
    // Add "Bottom line" to executive summary if not present
    if (!enhanced.includes('Bottom Line')) {
      const summaryMatch = enhanced.match(/## Executive Summary\n\n([\s\S]*?)(?=\n##)/)
      if (summaryMatch) {
        const summary = summaryMatch[1]
        if (!summary.includes('Bottom Line') && !summary.includes('Bottom line')) {
          enhanced = enhanced.replace(summaryMatch[0], `${summaryMatch[0]}\n**Bottom Line**: `)
          changes.push('Added "Bottom Line" section to executive summary')
        }
      }
    }
  }

  // Enhance euphemistic language
  const replacements: Array<[RegExp, string, string]> = [
    [/needs improvement/gi, 'is painful', 'Replaced euphemism with blunt language'],
    [/could be improved/gi, 'is broken', 'Replaced euphemism with blunt language'],
    [/room for growth/gi, 'has serious problems', 'Replaced euphemism with blunt language'],
    [/minor issues/gi, 'critical issues', 'Replaced euphemism with direct language'],
  ]

  for (const [pattern, replacement, change] of replacements) {
    if (pattern.test(enhanced)) {
      enhanced = enhanced.replace(pattern, replacement)
      changes.push(change)
    }
  }

  return { enhanced, changes }
}

/**
 * Generate brutal honesty prompt prefix for Ralph workflows
 */
export function generateBrutalHonestyPromptPrefix(): string {
  return `**BRUTAL HONESTY REQUIRED**

You are required to provide a brutally honest assessment. This means:

1. **Use blunt, direct language** - Say "painful", "frustrating", "broken", not "needs improvement"
2. **Include quantitative evidence** - Use specific numbers (file counts, percentages, line numbers)
3. **Show code examples** - Include file:line references for all issues
4. **Identify root causes** - Explain WHY issues exist, not just WHAT they are
5. **Avoid euphemisms** - Don't sugarcoat problems
6. **Use severity ratings** - CRITICAL/HIGH/MEDIUM/LOW, not just "issues"
7. **Provide honest grade** - Give realistic grade (D+, C-), not inflated
8. **Include "Would I Use This"** - Honest assessment of production readiness

**Do NOT:**
- Use soft language like "could be improved" or "needs work"
- Avoid calling out specific problems
- Inflate grades or assessments
- Skip critical issues

**DO:**
- Be direct and honest about problems
- Include specific evidence and numbers
- Show actual code examples
- Give realistic, honest grades

Your assessment will be automatically validated for brutal honesty standards.
`
}

/**
 * Validate analysis for brutal honesty requirements
 */
export function validateAnalysisForBrutalHonesty(analysis: CohesionAnalysis): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check that grade is realistic (not inflated)
  const gradeMatch = analysis.summary.overallGrade.match(/([A-F])[+-]?/)
  if (gradeMatch) {
    const grade = gradeMatch[1]
    // If grade is A or B but has critical issues, it's inflated
    if ((grade === 'A' || grade === 'B') && analysis.summary.criticalIssues > 0) {
      issues.push(
        `Grade ${grade} is inflated - has ${analysis.summary.criticalIssues} critical issues`,
      )
    }
  }

  // Check that issues have severity ratings
  const issuesWithoutSeverity = analysis.issues.filter((i) => !i.severity)
  if (issuesWithoutSeverity.length > 0) {
    issues.push(`${issuesWithoutSeverity.length} issues missing severity ratings`)
  }

  // Check that issues have evidence
  const issuesWithoutEvidence = analysis.issues.filter(
    (i) => !i.evidence || i.evidence.length === 0,
  )
  if (issuesWithoutEvidence.length > 0) {
    issues.push(`${issuesWithoutEvidence.length} issues missing evidence`)
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
