import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Command-line argument parsing for Cursor
const args = process.argv.slice(2)
const commandArgs = {
  context: args.find((arg) => arg.startsWith('--context='))?.split('=')[1],
  save: !args.includes('--no-save'),
  interactive: args.includes('--interactive'),
}

async function main() {
  console.log('🤖 RevealUI Smart Development Analyzer')
  console.log('======================================\n')

  // Get context information
  let contextInfo = commandArgs.context

  if (!contextInfo && commandArgs.interactive) {
    console.log('📝 Paste your task description below:')
    console.log('Include error messages, requirements, current behavior, expected behavior, etc.')
    console.log('Press Enter twice when finished.\n')

    contextInfo = await promptMultilineInput('Task Description: ')
  }

  if (!contextInfo) {
    console.error('❌ Task description is required')
    console.log('\nUsage:')
    console.log('  /smart-dev --context="paste your task description here"')
    console.log('  /smart-dev --interactive (for multiline input)')
    console.log('  /smart-dev --context="..." --no-save (skip saving to docs)')
    process.exit(1)
  }

  console.log('🔍 Analyzing task and generating development plan...\n')

  // Generate analysis
  const analysis = await generateAnalysis(contextInfo)

  // Save to docs folder if enabled
  if (commandArgs.save) {
    saveAnalysisToDocs(analysis, contextInfo)
  }

  // Display analysis
  console.log('✅ Analysis Complete!\n')
  console.log('=' * 80)
  console.log(analysis.formattedOutput)
  console.log('=' * 80)

  if (commandArgs.save) {
    console.log(`\n📁 Analysis saved to: docs/analyses/${analysis.filename}`)
    console.log('\n💡 Next Steps:')
    console.log('1. Review the analysis above')
    console.log('2. If you like the plan, run:')
    console.log(`   /generate-code --analysis="${analysis.rawOutput.replace(/"/g, '\\"')}"`)
    console.log('3. Or implement manually based on this plan')
  } else {
    console.log('\n💡 To implement this plan:')
    console.log('1. Copy the analysis above')
    console.log('2. Run: /generate-code --analysis="[paste analysis here]"')
  }
}

// Export for Cursor command system
export const command = {
  name: 'revealui:smart-dev',
  description: 'Analyze development tasks and generate implementation plans (saves to docs)',
  args: [
    { name: 'context', description: 'Task description to analyze', required: false },
    { name: 'interactive', description: 'Use interactive multiline input mode', required: false },
    { name: 'no-save', description: 'Skip saving analysis to docs folder', required: false },
  ],
  run: main,
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

// Helper functions
async function promptMultilineInput(prompt: string): Promise<string> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    const lines: string[] = []

    console.log(prompt)

    rl.on('line', (line) => {
      if (line.trim() === '' && lines.length > 0) {
        rl.close()
        resolve(lines.join('\n'))
        return
      }
      lines.push(line)
    })

    rl.on('close', () => {
      resolve(lines.join('\n'))
    })
  })
}

async function generateAnalysis(context: string) {
  // Extract key information from context
  const taskType = detectTaskType(context)
  const complexity = assessComplexity(context)
  const requirements = extractRequirements(context)
  const files = identifyRelevantFiles(context)
  const constraints = getConstraints()
  const successCriteria = generateSuccessCriteria(context, taskType)
  const risks = identifyRisks(context)
  const estimatedTime = estimateTime(complexity)

  // Generate formatted output
  const formattedOutput = `# 🤖 Smart Development Analysis

## 🎯 Task Classification
**Type:** ${taskType}
**Complexity:** ${complexity}
**Priority:** ${calculatePriority(taskType, complexity)}

## 📋 Understanding
**Core Problem:** ${extractCoreProblem(context)}
**Why It Matters:** ${extractBusinessImpact(context)}
**Current State:** ${extractCurrentState(context)}

## 🎯 Solution Requirements
**Must Do:**
${requirements.map(req => `- [ ] ${req}`).join('\n')}

## 🔧 Technical Approach
**Files to Modify:** ${files.join(', ')}
**Key Changes:** ${generateKeyChanges(taskType, requirements)}
**Testing Strategy:** ${generateTestingStrategy(taskType, requirements)}

## 🚫 Constraints & Rules
**RevealUI Standards:**
${constraints.map(c => `- [x] ${c}`).join('\n')}

## ✅ Success Validation
**Definition of Done:**
${successCriteria.map(c => `- [ ] ${c}`).join('\n')}

## 🔄 Implementation Plan
**Phase 1:** ${generatePhase1(taskType, requirements)}
**Phase 2:** ${generatePhase2(taskType, requirements)}
**Phase 3:** ${generatePhase3(taskType)}

**Estimated Time:** ${estimatedTime}

## ⚠️ Risks & Considerations
**Potential Issues:**
${risks.map(r => `- ${r}`).join('\n')}

---

**🤖 Analysis generated ${new Date().toISOString()}**
**Ready for implementation or code generation**`

  return {
    formattedOutput,
    rawOutput: formattedOutput,
    filename: generateFilename(context, taskType),
    metadata: {
      taskType,
      complexity,
      requirements,
      files,
      estimatedTime,
      generatedAt: new Date().toISOString()
    }
  }
}

function detectTaskType(context: string): string {
  const lower = context.toLowerCase()

  if (lower.includes('fix') || lower.includes('bug') || lower.includes('error') || lower.includes('crash')) {
    return 'bug-fix'
  }
  if (lower.includes('add') || lower.includes('implement') || lower.includes('create') || lower.includes('feature')) {
    return 'feature'
  }
  if (lower.includes('refactor') || lower.includes('cleanup') || lower.includes('improve') || lower.includes('optimize')) {
    return 'refactor'
  }
  if (lower.includes('test') || lower.includes('spec') || lower.includes('coverage')) {
    return 'test'
  }
  if (lower.includes('review') || lower.includes('audit') || lower.includes('assess')) {
    return 'review'
  }

  return 'development'
}

function assessComplexity(context: string): 'quick-fix' | 'small-task' | 'medium-project' | 'complex-effort' {
  const indicators = {
    complex: ['multiple files', 'architecture', 'system', 'integration', 'breaking change', 'security'],
    medium: ['several', 'multiple', 'complex', 'api', 'database', 'frontend', 'backend']
  }

  const lower = context.toLowerCase()

  if (indicators.complex.some(word => lower.includes(word))) {
    return 'complex-effort'
  }
  if (indicators.medium.some(word => lower.includes(word))) {
    return 'medium-project'
  }
  if (context.split(' ').length > 50 || context.includes('\n')) {
    return 'small-task'
  }

  return 'quick-fix'
}

function extractRequirements(context: string): string[] {
  const requirements: string[] = []
  const lower = context.toLowerCase()

  // Extract explicit requirements
  const patterns = [
    /(?:must|should|need to|required to)\s+(.+?)(?:\n|$|;|\.)/gi,
    /(?:fix|implement|add|update|create)\s+(.+?)(?:\n|$|;|\.)/gi,
    /(?:handle|support|allow)\s+(.+?)(?:\n|$|;|\.)/gi
  ]

  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(context)) !== null) {
      requirements.push(match[1].trim())
    }
  })

  // Add inferred requirements based on context
  if (lower.includes('email') || lower.includes('validation')) {
    requirements.push('Implement proper input validation')
  }
  if (lower.includes('test') || lower.includes('coverage')) {
    requirements.push('Add comprehensive test coverage')
  }
  if (lower.includes('error') || lower.includes('crash')) {
    requirements.push('Add proper error handling')
  }
  if (lower.includes('security') || lower.includes('auth')) {
    requirements.push('Ensure security best practices')
  }

  return [...new Set(requirements)].slice(0, 5)
}

function identifyRelevantFiles(context: string): string[] {
  const files: string[] = []
  const lower = context.toLowerCase()

  // Auth-related files
  if (lower.includes('auth') || lower.includes('login') || lower.includes('password') || lower.includes('user')) {
    files.push('packages/auth/src/server/auth.ts')
    files.push('packages/auth/src/__tests__/integration/auth-flow.test.ts')
  }

  // Database files
  if (lower.includes('database') || lower.includes('db') || lower.includes('query') || lower.includes('data')) {
    files.push('packages/db/src/schema.ts')
    files.push('packages/db/src/client.ts')
  }

  // API/Route files
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) {
    files.push('packages/core/src/api/rest.ts')
  }

  // UI/Component files
  if (lower.includes('ui') || lower.includes('component') || lower.includes('frontend')) {
    files.push('packages/presentation/src/components/')
  }

  // Test files
  if (lower.includes('test') || lower.includes('spec')) {
    files.push('packages/*/src/__tests__/**/*.test.ts')
  }

  return files.length > 0 ? files : ['[Files to be identified during implementation]']
}

function getConstraints(): string[] {
  return [
    'ESM only (no CommonJS)',
    'Named exports preferred',
    'No GraphQL (REST + RPC only)',
    'TypeScript strict mode',
    'Async/await over promises',
    'JSDoc comments for public APIs'
  ]
}

function generateSuccessCriteria(context: string, taskType: string): string[] {
  const criteria = []

  if (taskType === 'bug-fix') {
    criteria.push('Issue is resolved without regression')
    criteria.push('All existing tests pass')
    criteria.push('Error handling works correctly')
  } else if (taskType === 'feature') {
    criteria.push('Feature works as specified')
    criteria.push('UI/UX meets requirements')
    criteria.push('Tests cover new functionality')
  } else if (taskType === 'test') {
    criteria.push('Test coverage meets targets')
    criteria.push('All tests pass consistently')
    criteria.push('Edge cases are covered')
  } else {
    criteria.push('Implementation meets requirements')
    criteria.push('Code follows project standards')
    criteria.push('Tests pass and coverage adequate')
  }

  return criteria
}

function identifyRisks(context: string): string[] {
  const risks = []
  const lower = context.toLowerCase()

  if (lower.includes('breaking change') || lower.includes('breaking')) {
    risks.push('Breaking changes may affect other parts of the system')
  }

  if (lower.includes('database') || lower.includes('migration')) {
    risks.push('Database changes require careful testing and rollback planning')
  }

  if (lower.includes('security') || lower.includes('auth')) {
    risks.push('Security changes must be thoroughly validated')
  }

  if (lower.includes('performance')) {
    risks.push('Performance changes need benchmarking')
  }

  if (lower.includes('api') || lower.includes('endpoint')) {
    risks.push('API changes may affect existing integrations')
  }

  return risks.length > 0 ? risks : ['Standard development risks apply']
}

function estimateTime(complexity: string): string {
  switch (complexity) {
    case 'quick-fix': return '15min - 1hr'
    case 'small-task': return '1hr - 4hrs'
    case 'medium-project': return '4hrs - 1 day'
    case 'complex-effort': return '1-3 days'
    default: return '2-4 hours'
  }
}

function calculatePriority(taskType: string, complexity: string): string {
  if (taskType === 'bug-fix' && ['complex-effort', 'medium-project'].includes(complexity)) {
    return 'critical'
  }
  if (taskType === 'security' || complexity === 'complex-effort') {
    return 'high'
  }
  if (complexity === 'medium-project') {
    return 'medium'
  }
  return 'low'
}

function extractCoreProblem(context: string): string {
  // Extract the main problem statement
  const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const firstSentence = sentences[0]?.trim() || 'Problem to be analyzed'
  return firstSentence.charAt(0).toLowerCase() + firstSentence.slice(1)
}

function extractBusinessImpact(context: string): string {
  const lower = context.toLowerCase()

  if (lower.includes('user') || lower.includes('customer')) {
    return 'Affects user experience and satisfaction'
  }
  if (lower.includes('security') || lower.includes('breach')) {
    return 'Critical security implications for the platform'
  }
  if (lower.includes('performance') || lower.includes('slow')) {
    return 'Impacts system performance and scalability'
  }
  if (lower.includes('block') || lower.includes('prevent')) {
    return 'Blocks critical functionality or user flows'
  }

  return 'Improves system reliability and maintainability'
}

function extractCurrentState(context: string): string {
  const lower = context.toLowerCase()

  if (lower.includes('crash') || lower.includes('error')) {
    return 'System crashes or throws errors'
  }
  if (lower.includes('work') && lower.includes('not')) {
    return 'Feature is not working as expected'
  }
  if (lower.includes('missing')) {
    return 'Functionality is missing or incomplete'
  }
  if (lower.includes('slow') || lower.includes('performance')) {
    return 'Performance issues exist'
  }

  return 'Current implementation needs improvement'
}

function generateKeyChanges(taskType: string, requirements: string[]): string {
  if (taskType === 'bug-fix') {
    return 'Fix root cause, add error handling, improve validation'
  }
  if (taskType === 'feature') {
    return 'Implement new functionality, add UI components, integrate with existing systems'
  }
  if (taskType === 'test') {
    return 'Add test files, implement test cases, ensure coverage'
  }
  if (taskType === 'refactor') {
    return 'Restructure code, improve maintainability, preserve functionality'
  }

  return 'Implement requirements while maintaining code quality'
}

function generateTestingStrategy(taskType: string, requirements: string[]): string {
  if (taskType === 'bug-fix') {
    return 'Add regression tests, test edge cases, verify fix works'
  }
  if (taskType === 'feature') {
    return 'Unit tests for components, integration tests for workflows, E2E for user flows'
  }
  if (taskType === 'test') {
    return 'Achieve coverage targets, test edge cases, ensure reliability'
  }

  return 'Unit tests for logic, integration tests for interactions, manual testing for UI'
}

function generatePhase1(taskType: string, requirements: string[]): string {
  if (taskType === 'bug-fix') {
    return 'Reproduce issue and identify root cause'
  }
  if (taskType === 'feature') {
    return 'Design solution and create basic structure'
  }
  if (taskType === 'test') {
    return 'Set up test infrastructure and plan test cases'
  }

  return 'Analyze requirements and plan implementation approach'
}

function generatePhase2(taskType: string, requirements: string[]): string {
  if (taskType === 'bug-fix') {
    return 'Implement fix and add error handling'
  }
  if (taskType === 'feature') {
    return 'Implement core functionality and integrate components'
  }
  if (taskType === 'test') {
    return 'Implement test cases and achieve coverage targets'
  }

  return 'Implement core functionality and handle edge cases'
}

function generatePhase3(taskType: string): string {
  return 'Add tests, verify functionality, and prepare for review'
}

function generateFilename(context: string, taskType: string): string {
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const slug = context.slice(0, 50)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${timestamp}-${taskType}-${slug}.md`
}

function saveAnalysisToDocs(analysis: any, originalContext: string) {
  const docsDir = join(process.cwd(), 'docs', 'analyses')

  // Ensure directory exists
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true })
  }

  const filePath = join(docsDir, analysis.filename)

  // Create enhanced markdown with metadata
  const fullContent = `# 🤖 Smart Development Analysis

**Generated:** ${analysis.metadata.generatedAt}
**Task Type:** ${analysis.metadata.taskType}
**Complexity:** ${analysis.metadata.complexity}
**Files:** ${analysis.metadata.files.join(', ')}
**Estimated Time:** ${analysis.metadata.estimatedTime}

## Original Task Description
${originalContext}

---

${analysis.formattedOutput}

## Implementation Notes

**Command to generate code from this analysis:**
\`\`\`
/generate-code --analysis="${analysis.rawOutput.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
\`\`\`

**Status:** Analysis Complete - Ready for Implementation
`

  writeFileSync(filePath, fullContent, 'utf8')
  console.log(`📁 Analysis saved to: docs/analyses/${analysis.filename}`)
}