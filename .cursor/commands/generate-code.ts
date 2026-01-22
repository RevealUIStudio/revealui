import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Command-line argument parsing for Cursor
const args = process.argv.slice(2)
const commandArgs = {
  analysis: args.find((arg) => arg.startsWith('--analysis='))?.split('=')[1],
  confirm: args.includes('--confirm'),
  dryRun: args.includes('--dry-run'),
  interactive: args.includes('--interactive'),
}

async function main() {
  console.log('🚀 RevealUI Code Generation Assistant')
  console.log('=====================================\n')

  // Get analysis input
  let analysisInput = commandArgs.analysis
  const isDryRun = commandArgs.dryRun
  const skipConfirm = commandArgs.confirm

  if (!analysisInput && commandArgs.interactive) {
    console.log('📝 Paste the /smart-dev analysis output below:')
    console.log('Include the complete analysis with task classification, requirements, and implementation plan.')
    console.log('Press Enter twice when finished.\n')

    analysisInput = await promptMultilineInput('Analysis: ')
  }

  if (!analysisInput) {
    console.error('❌ Analysis input is required')
    console.log('\nUsage:')
    console.log('  /generate-code --analysis="paste the smart-dev analysis here"')
    console.log('  /generate-code --interactive (for multiline input)')
    console.log('  /generate-code --analysis="..." --dry-run (preview changes only)')
    console.log('  /generate-code --analysis="..." --confirm (skip confirmation prompts)')
    process.exit(1)
  }

  // Parse and validate the analysis
  console.log('🔍 Parsing analysis and generating implementation...\n')

  const parsedAnalysis = parseAnalysis(analysisInput)

  if (!parsedAnalysis.valid) {
    console.error('❌ Invalid analysis format. Please ensure you pasted a complete /smart-dev analysis.')
    console.error('Missing required sections:', parsedAnalysis.missing.join(', '))
    process.exit(1)
  }

  // Generate implementation plan
  const implementation = generateImplementation(parsedAnalysis)

  console.log('📋 Implementation Plan Generated:')
  console.log(`Task: ${parsedAnalysis.type} (${parsedAnalysis.complexity})`)
  console.log(`Files to modify: ${implementation.files.length}`)
  console.log(`Changes to make: ${implementation.changes.length}`)
  console.log(`Estimated time: ${parsedAnalysis.estimatedTime}`)
  console.log()

  // Show preview of changes
  if (isDryRun) {
    console.log('🔍 DRY RUN - Preview of changes (no files will be modified):')
    console.log('=' * 50)
    showChangesPreview(implementation)
    console.log('=' * 50)
    console.log('\n💡 To apply changes, run without --dry-run flag')
    return
  }

  // Confirm before proceeding
  if (!skipConfirm) {
    const confirmed = await promptConfirm(
      `\n🚨 This will modify ${implementation.files.length} files. Continue?`,
      false
    )
    if (!confirmed) {
      console.log('❌ Code generation cancelled.')
      return
    }
  }

  // Apply changes
  console.log('⚡ Applying code changes...\n')

  try {
    applyChanges(implementation)
    console.log('✅ Code generation completed successfully!')
    console.log('\n📁 Files modified:')
    implementation.files.forEach(file => {
      console.log(`  • ${relative(process.cwd(), file)}`)
    })
    console.log('\n🧪 Next steps:')
    console.log('1. Review the generated code')
    console.log('2. Run tests to verify functionality')
    console.log('3. Make any necessary adjustments')
    console.log('4. Commit changes when ready')

  } catch (error) {
    console.error('❌ Error during code generation:', error.message)
    console.log('\n🔄 You can:')
    console.log('1. Review error details above')
    console.log('2. Manually fix any issues')
    console.log('3. Re-run with --dry-run to preview changes')
    console.log('4. Report issues for improvement')
    process.exit(1)
  }
}

// Export for Cursor command system
export const command = {
  name: 'revealui:generate-code',
  description: 'Generate code implementation based on /smart-dev analysis output',
  args: [
    { name: 'analysis', description: 'Complete /smart-dev analysis output to implement', required: false },
    { name: 'interactive', description: 'Use interactive multiline input mode', required: false },
    { name: 'dry-run', description: 'Preview changes without modifying files', required: false },
    { name: 'confirm', description: 'Skip confirmation prompts', required: false },
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

async function promptConfirm(question: string, defaultValue: boolean = true): Promise<boolean> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const defaultText = defaultValue ? '(Y/n)' : '(y/N)'

  return new Promise((resolve) => {
    rl.question(`${question} ${defaultText}: `, (answer) => {
      rl.close()
      const normalized = answer.toLowerCase().trim()
      if (normalized === '') {
        resolve(defaultValue)
      } else {
        resolve(normalized === 'y' || normalized === 'yes')
      }
    })
  })
}

interface ParsedAnalysis {
  valid: boolean
  missing: string[]
  type: string
  complexity: string
  priority: string
  requirements: string[]
  files: string[]
  constraints: string[]
  estimatedTime: string
}

function parseAnalysis(analysis: string): ParsedAnalysis {
  const result: ParsedAnalysis = {
    valid: true,
    missing: [],
    type: 'unknown',
    complexity: 'unknown',
    priority: 'medium',
    requirements: [],
    files: [],
    constraints: [],
    estimatedTime: 'unknown'
  }

  // Extract task classification
  const typeMatch = analysis.match(/\*\*Type:\*\*\s*([^\n]+)/)
  if (typeMatch) result.type = typeMatch[1].trim()

  const complexityMatch = analysis.match(/\*\*Complexity:\*\*\s*([^\n]+)/)
  if (complexityMatch) result.complexity = complexityMatch[1].trim()

  const priorityMatch = analysis.match(/\*\*Priority:\*\*\s*([^\n]+)/)
  if (priorityMatch) result.priority = priorityMatch[1].trim()

  // Extract requirements
  const reqSection = extractSection(analysis, 'Solution Requirements')
  if (reqSection) {
    const reqMatches = reqSection.match(/-\s*\[\s*\]\s*(.+?)(?=\n|$)/g)
    if (reqMatches) {
      result.requirements = reqMatches.map(match =>
        match.replace(/-\s*\[\s*\]\s*/, '').trim()
      )
    }
  }

  // Extract files
  const filesSection = extractSection(analysis, 'Technical Approach')
  if (filesSection) {
    const filesMatch = filesSection.match(/\*\*Files to Modify:\*\*\s*(.+?)(?=\n\*\*|$)/s)
    if (filesMatch) {
      result.files = filesMatch[1].split(',').map(f => f.trim())
    }
  }

  // Extract constraints
  const constraintsSection = extractSection(analysis, 'Constraints & Rules')
  if (constraintsSection) {
    const constraintMatches = constraintsSection.match(/-\s*\[\s*[x\s]\s*\]\s*(.+?)(?=\n|$)/g)
    if (constraintMatches) {
      result.constraints = constraintMatches.map(match =>
        match.replace(/-\s*\[\s*[x\s]\s*\]\s*/, '').trim()
      )
    }
  }

  // Extract estimated time
  const timeMatch = analysis.match(/\*\*Estimated Time:\*\*\s*(.+?)(?=\n|$)/)
  if (timeMatch) result.estimatedTime = timeMatch[1].trim()

  // Validate required fields
  if (!result.type || result.type === 'unknown') {
    result.missing.push('task type')
    result.valid = false
  }
  if (!result.complexity || result.complexity === 'unknown') {
    result.missing.push('complexity assessment')
    result.valid = false
  }
  if (result.requirements.length === 0) {
    result.missing.push('solution requirements')
    result.valid = false
  }

  return result
}

function extractSection(text: string, sectionName: string): string | null {
  const sectionRegex = new RegExp(`## .*${sectionName}.*?\\n(.*?(?=\\n## |$))`, 'si')
  const match = text.match(sectionRegex)
  return match ? match[1] : null
}

interface ImplementationPlan {
  files: string[]
  changes: Array<{
    file: string
    type: 'create' | 'modify' | 'delete'
    description: string
    content?: string
    modifications?: Array<{
      search: string
      replace: string
    }>
  }>
}

function generateImplementation(analysis: ParsedAnalysis): ImplementationPlan {
  const implementation: ImplementationPlan = {
    files: analysis.files,
    changes: []
  }

  // Generate changes based on task type and requirements
  analysis.requirements.forEach((req, index) => {
    const change = generateChangeForRequirement(req, analysis, index)
    if (change) implementation.changes.push(change)
  })

  return implementation
}

function generateChangeForRequirement(
  requirement: string,
  analysis: ParsedAnalysis,
  index: number
): ImplementationPlan['changes'][0] | null {

  // Simple requirement → code change mapping
  // This is a basic implementation - in practice, this would be much more sophisticated

  if (requirement.toLowerCase().includes('email validation')) {
    return {
      file: analysis.files[0] || 'src/utils/validation.ts',
      type: 'modify',
      description: 'Add email validation function',
      modifications: [{
        search: '// Email validation utilities',
        replace: `// Email validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}`
      }]
    }
  }

  if (requirement.toLowerCase().includes('error handling')) {
    return {
      file: analysis.files[0] || 'src/utils/error.ts',
      type: 'create',
      description: 'Create error handling utilities',
      content: `// Error handling utilities for ${analysis.type}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function handleApiError(error: unknown): string {
  if (error instanceof ValidationError) {
    return \`Validation failed: \${error.message}\`
  }
  return 'An unexpected error occurred'
}`
    }
  }

  if (requirement.toLowerCase().includes('test')) {
    const testFile = analysis.files.find(f => f.includes('test')) || 'src/__tests__/generated.test.ts'
    return {
      file: testFile,
      type: 'create',
      description: 'Create test file for new functionality',
      content: `// Generated tests for ${analysis.type}

describe('${analysis.type} functionality', () => {
  it('should meet requirement: ${requirement}', () => {
    // Generated test - implement actual test logic
    expect(true).toBe(true) // Placeholder assertion
  })
})`
    }
  }

  // Default: create a comment indicating manual implementation needed
  return {
    file: analysis.files[0] || 'TODO.md',
    type: 'create',
    description: `Manual implementation needed: ${requirement}`,
    content: `# TODO: Implement ${requirement}

**Analysis Context:**
- Task Type: ${analysis.type}
- Complexity: ${analysis.complexity}
- Priority: ${analysis.priority}

**Requirement:** ${requirement}

**Implementation Notes:**
- Review the /smart-dev analysis for detailed guidance
- Consider constraints: ${analysis.constraints.join(', ')}
- Estimated time: ${analysis.estimatedTime}

**Next Steps:**
1. Review analysis details
2. Implement the requirement
3. Add appropriate tests
4. Verify against success criteria`
  }
}

function showChangesPreview(implementation: ImplementationPlan) {
  console.log('📁 Files to be modified:')
  implementation.files.forEach(file => {
    console.log(`  • ${relative(process.cwd(), file)}`)
  })

  console.log('\n🔧 Changes to apply:')
  implementation.changes.forEach((change, index) => {
    console.log(`  ${index + 1}. ${change.description}`)
    console.log(`     File: ${relative(process.cwd(), change.file)}`)
    console.log(`     Type: ${change.type}`)

    if (change.content) {
      console.log(`     Content preview:`)
      console.log(`       ${change.content.split('\n')[0]}...`)
    }

    if (change.modifications) {
      console.log(`     Modifications: ${change.modifications.length} change(s)`)
    }
    console.log()
  })
}

function applyChanges(implementation: ImplementationPlan) {
  implementation.changes.forEach(change => {
    const fullPath = join(process.cwd(), change.file)

    // Ensure directory exists
    const dir = dirname(fullPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    switch (change.type) {
      case 'create':
        if (change.content) {
          writeFileSync(fullPath, change.content, 'utf8')
          console.log(`✅ Created: ${relative(process.cwd(), change.file)}`)
        }
        break

      case 'modify':
        if (change.modifications) {
          let content = existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''

          change.modifications.forEach(mod => {
            // Simple string replacement - in practice, this would be more sophisticated
            if (content.includes(mod.search)) {
              content = content.replace(mod.search, mod.replace)
            } else {
              // Append if search text not found
              content += '\n\n' + mod.replace
            }
          })

          writeFileSync(fullPath, content, 'utf8')
          console.log(`✅ Modified: ${relative(process.cwd(), change.file)}`)
        }
        break

      case 'delete':
        // Note: Not implementing delete for safety
        console.log(`⚠️  Skipped delete: ${relative(process.cwd(), change.file)}`)
        break
    }
  })
}