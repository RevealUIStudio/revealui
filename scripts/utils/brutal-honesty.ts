/**
 * Brutal honesty prompt enhancement for cohesion workflows
 * Adds direct, unfiltered feedback instructions to prompts
 */

/**
 * Generate a brutal honesty prompt prefix
 * This enhances prompts with instructions for direct, honest feedback
 */
export function generateBrutalHonestyPromptPrefix(): string {
  return `# BRUTAL HONESTY MODE

You are operating in BRUTAL HONESTY MODE for this cohesion workflow.

## Core Principles
1. **Be Direct**: Call out issues directly without softening language
2. **No Sugarcoating**: Avoid phrases like "could be better" - say "is broken"
3. **Focus on Impact**: Explain WHY something is wrong, not just THAT it's wrong
4. **Action-Oriented**: Every criticism must include a specific fix
5. **No Excuses**: Don't justify bad code - identify it and fix it

## Communication Style
- ❌ "This approach might not be ideal..."
- ✅ "This approach is wrong because..."

- ❌ "Consider refactoring this..."
- ✅ "This must be refactored immediately because..."

- ❌ "There could be performance implications..."
- ✅ "This will cause performance problems in production..."

## Quality Standards
- Code that "works" is not enough - it must be maintainable, testable, and performant
- Patterns that are "common" are not automatically correct
- "Technical debt" is not an excuse - it's a problem to fix

## Expected Output
For every issue you identify:
1. State the problem directly and clearly
2. Explain the impact (performance, maintainability, bugs, etc.)
3. Provide a specific, actionable solution
4. Implement the fix immediately if within scope

Remember: The goal is IMPROVEMENT, not politeness. Be honest, be direct, be helpful.

---

# TASK`
}

// =============================================================================
// Validation and Enhancement
// =============================================================================

interface BrutalHonestyValidation {
  valid: boolean
  score: number
  violations: string[]
  suggestions: string[]
}

interface BrutalHonestyEnhancement {
  enhanced: string
  changes: string[]
}

const SOFT_PHRASES = [
  'could be better',
  'might want to',
  'perhaps',
  'it seems',
  'may not be ideal',
  'could potentially',
  'somewhat',
]

const REQUIRED_ELEMENTS = [
  { pattern: /\*\*impact\*\*/i, name: 'impact statement' },
  { pattern: /recommendation|fix|solution/i, name: 'actionable recommendation' },
]

/**
 * Validate that an assessment meets brutal honesty standards
 */
export function validateBrutalHonesty(content: string): BrutalHonestyValidation {
  const violations: string[] = []
  const suggestions: string[] = []
  let score = 100

  for (const phrase of SOFT_PHRASES) {
    const regex = new RegExp(phrase, 'gi')
    const matches = content.match(regex)
    if (matches) {
      violations.push(`Found soft language: "${phrase}" (${matches.length} occurrences)`)
      score -= matches.length * 5
    }
  }

  for (const element of REQUIRED_ELEMENTS) {
    if (!element.pattern.test(content)) {
      violations.push(`Missing required element: ${element.name}`)
      score -= 10
    }
  }

  if (!(content.includes('`') || content.includes('```'))) {
    violations.push('No code references found - assessment lacks specificity')
    score -= 15
  }

  if (!(content.includes('Action Items') || content.includes('action items'))) {
    suggestions.push('Add explicit action items section')
    score -= 5
  }

  if (!content.includes('Grade:')) {
    suggestions.push('Include grade prominently')
    score -= 5
  }

  score = Math.max(0, Math.min(100, score))

  return {
    valid: violations.length === 0 && score >= 70,
    score,
    violations,
    suggestions,
  }
}

/**
 * Enhance assessment content with brutal honesty
 */
export function enhanceWithBrutalHonesty(content: string): BrutalHonestyEnhancement {
  let enhanced = content
  const changes: string[] = []

  const replacements: Array<[RegExp, string]> = [
    [/could be better/gi, 'needs improvement'],
    [/might want to/gi, 'must'],
    [/perhaps/gi, ''],
    [/it seems (like |that )?/gi, ''],
    [/may not be ideal/gi, 'is problematic'],
    [/could potentially/gi, 'will'],
    [/somewhat/gi, ''],
  ]

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(enhanced)) {
      const before = enhanced
      enhanced = enhanced.replace(pattern, replacement)
      if (enhanced !== before) {
        changes.push(`Replaced soft language matching "${pattern.source}"`)
      }
    }
  }

  return { enhanced, changes }
}
