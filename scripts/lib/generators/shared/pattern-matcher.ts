/**
 * Pattern Matcher Utility
 *
 * Centralized pattern matching for code analysis.
 * Provides regex and AST-based pattern matching for common code patterns.
 *
 * @dependencies
 * - None (standalone utility)
 *
 * @example
 * ```typescript
 * // Match JSDoc comments
 * const docs = matchJSDoc(sourceCode)
 *
 * // Match exports
 * const exports = matchExports(sourceCode, 'function')
 *
 * // Match HTTP methods
 * const methods = matchHTTPMethods(sourceCode)
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * JSDoc match result
 */
export interface JsDocMatch {
  /** Full JSDoc comment block */
  fullMatch: string
  /** JSDoc description (first paragraph) */
  description: string
  /** Line number where JSDoc starts */
  line: number
  /** Associated code following the JSDoc */
  associatedCode?: string
  /** Extracted tags */
  tags: JsDocTag[]
}

/**
 * JSDoc tag
 */
export interface JsDocTag {
  /** Tag name (e.g., 'param', 'returns') */
  name: string
  /** Tag value/description */
  value: string
}

/**
 * Export match result
 */
export interface ExportMatch {
  /** Export type (function, const, class, etc.) */
  type: string
  /** Exported name */
  name: string
  /** Full export statement */
  statement: string
  /** Line number */
  line: number
  /** Whether it's a default export */
  isDefault: boolean
}

/**
 * Import match result
 */
export interface ImportMatch {
  /** Imported names */
  names: string[]
  /** Module path */
  from: string
  /** Full import statement */
  statement: string
  /** Whether it's a default import */
  isDefault: boolean
  /** Whether it's a namespace import (import * as) */
  isNamespace: boolean
  /** Namespace alias if applicable */
  namespaceAlias?: string
}

/**
 * Export type filter
 */
export type ExportType = 'function' | 'const' | 'class' | 'interface' | 'type' | 'all'

// =============================================================================
// JSDoc Matching
// =============================================================================

/**
 * Match JSDoc comments in source code
 *
 * @param content - Source code content
 * @returns Array of JSDoc matches
 *
 * @example
 * ```typescript
 * const docs = matchJSDoc(sourceCode)
 * for (const doc of docs) {
 *   console.log(doc.description, doc.tags)
 * }
 * ```
 */
export function matchJSDoc(content: string): JsDocMatch[] {
  const matches: JsDocMatch[] = []
  const lines = content.split('\n')

  // Regex to match JSDoc blocks: /**  ... */
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g
  let match: RegExpExecArray | null

  while ((match = jsdocRegex.exec(content)) !== null) {
    const fullMatch = match[0]
    const startIndex = match.index

    // Calculate line number
    const lineNumber = content.substring(0, startIndex).split('\n').length

    // Extract description (first paragraph before any @tags)
    const cleanedDoc = fullMatch
      .replace(/^\/\*\*/, '') // Remove /**
      .replace(/\*\/$/, '') // Remove */
      .replace(/^\s*\*\s?/gm, '') // Remove leading * from each line

    const parts = cleanedDoc.split(/\n\s*@/)
    const description = parts[0].trim()

    // Extract tags
    const tags: JsDocTag[] = []
    for (let i = 1; i < parts.length; i++) {
      const tagContent = parts[i].trim()
      const spaceIndex = tagContent.indexOf(' ')
      if (spaceIndex > 0) {
        tags.push({
          name: tagContent.substring(0, spaceIndex),
          value: tagContent.substring(spaceIndex + 1).trim(),
        })
      } else {
        tags.push({
          name: tagContent,
          value: '',
        })
      }
    }

    // Try to find associated code (next non-empty line after JSDoc)
    let associatedCode: string | undefined
    for (let i = lineNumber; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('*') && !line.startsWith('*/')) {
        associatedCode = line
        break
      }
    }

    matches.push({
      fullMatch,
      description,
      line: lineNumber,
      associatedCode,
      tags,
    })
  }

  return matches
}

// =============================================================================
// Export Matching
// =============================================================================

/**
 * Match export statements in source code
 *
 * @param content - Source code content
 * @param type - Type of exports to match (default: 'all')
 * @returns Array of export matches
 *
 * @example
 * ```typescript
 * const functions = matchExports(sourceCode, 'function')
 * const constants = matchExports(sourceCode, 'const')
 * ```
 */
export function matchExports(content: string, type: ExportType = 'all'): ExportMatch[] {
  const matches: ExportMatch[] = []
  const _lines = content.split('\n')

  // Patterns for different export types
  const patterns: Record<string, RegExp> = {
    function: /export\s+(async\s+)?function\s+(\w+)/g,
    const: /export\s+const\s+(\w+)/g,
    class: /export\s+class\s+(\w+)/g,
    interface: /export\s+interface\s+(\w+)/g,
    type: /export\s+type\s+(\w+)/g,
    default: /export\s+default\s+(\w+|function|class)/g,
  }

  // Select patterns based on type filter
  const selectedPatterns =
    type === 'all' ? Object.entries(patterns) : [[type, patterns[type as keyof typeof patterns]]]

  for (const [exportType, pattern] of selectedPatterns) {
    if (!pattern) continue

    let match: RegExpExecArray | null
    const regex = new RegExp(pattern.source, pattern.flags)

    while ((match = regex.exec(content)) !== null) {
      const statement = match[0]
      const name = match[match.length - 1] // Last capture group is the name
      const startIndex = match.index

      // Calculate line number
      const lineNumber = content.substring(0, startIndex).split('\n').length

      matches.push({
        type: exportType,
        name,
        statement,
        line: lineNumber,
        isDefault: exportType === 'default',
      })
    }
  }

  return matches
}

// =============================================================================
// Import Matching
// =============================================================================

/**
 * Match import statements in source code
 *
 * @param content - Source code content
 * @returns Array of import matches
 *
 * @example
 * ```typescript
 * const imports = matchImports(sourceCode)
 * for (const imp of imports) {
 *   console.log(`Imports from ${imp.from}:`, imp.names)
 * }
 * ```
 */
export function matchImports(content: string): ImportMatch[] {
  const matches: ImportMatch[] = []

  // Pattern for named imports: import { foo, bar } from 'module'
  const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null

  while ((match = namedImportRegex.exec(content)) !== null) {
    const names = match[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    const from = match[2]

    matches.push({
      names,
      from,
      statement: match[0],
      isDefault: false,
      isNamespace: false,
    })
  }

  // Pattern for default imports: import foo from 'module'
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g
  while ((match = defaultImportRegex.exec(content)) !== null) {
    const name = match[1]
    const from = match[2]

    matches.push({
      names: [name],
      from,
      statement: match[0],
      isDefault: true,
      isNamespace: false,
    })
  }

  // Pattern for namespace imports: import * as foo from 'module'
  const namespaceImportRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g
  while ((match = namespaceImportRegex.exec(content)) !== null) {
    const alias = match[1]
    const from = match[2]

    matches.push({
      names: [alias],
      from,
      statement: match[0],
      isDefault: false,
      isNamespace: true,
      namespaceAlias: alias,
    })
  }

  return matches
}

// =============================================================================
// HTTP Method Matching
// =============================================================================

/**
 * Match HTTP method handlers in source code
 *
 * @param content - Source code content
 * @returns Array of HTTP method names found
 *
 * @example
 * ```typescript
 * const methods = matchHTTPMethods(routeFile)
 * // ['GET', 'POST', 'DELETE']
 * ```
 */
export function matchHTTPMethods(content: string): string[] {
  const methods: string[] = []
  const methodNames = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

  for (const method of methodNames) {
    const patterns = [
      `export async function ${method}`,
      `export function ${method}`,
      `export const ${method}`,
    ]

    if (patterns.some((pattern) => content.includes(pattern))) {
      methods.push(method)
    }
  }

  return methods
}

// =============================================================================
// Contract/Schema Matching
// =============================================================================

/**
 * Match contract exports in source code
 *
 * @param content - Source code content
 * @returns Array of contract names
 *
 * @example
 * ```typescript
 * const contracts = matchContracts(sourceCode)
 * // ['UserContract', 'PostContract']
 * ```
 */
export function matchContracts(content: string): string[] {
  const matches = content.match(/export const (\w+Contract)/g) || []
  return matches.map((m) => m.replace('export const ', ''))
}

/**
 * Match schema exports in source code
 *
 * @param content - Source code content
 * @returns Array of schema names
 *
 * @example
 * ```typescript
 * const schemas = matchSchemas(sourceCode)
 * // ['UserSelectSchema', 'UserInsertSchema']
 * ```
 */
export function matchSchemas(content: string): string[] {
  const matches = content.match(/export const (\w+(Select|Insert)Schema)/g) || []
  return matches.map((m) => m.replace('export const ', ''))
}

/**
 * Match table definition exports
 *
 * @param content - Source code content
 * @returns Array of table names
 *
 * @example
 * ```typescript
 * const tables = matchTables(sourceCode)
 * // ['users', 'posts', 'comments']
 * ```
 */
export function matchTables(content: string): string[] {
  const matches = content.match(/export const (\w+)\s*=\s*pgTable/g) || []
  return matches
    .map((m) => {
      const match = /export const (\w+)/.exec(m)
      return match ? match[1] : ''
    })
    .filter(Boolean)
}

// =============================================================================
// TypeScript-specific Matching
// =============================================================================

/**
 * Match TypeScript 'any' type usage
 *
 * @param content - Source code content
 * @returns Count of 'any' type usages
 *
 * @example
 * ```typescript
 * const anyCount = matchAnyTypes(sourceCode)
 * // 5
 * ```
 */
export function matchAnyTypes(content: string): number {
  // Match ': any' declarations but avoid 'any' in strings or comments
  const patterns = [
    /:\s*any\b/g, // : any
    /<any>/g, // <any>
    /\(any\)/g, // (any)
    /Array<any>/g, // Array<any>
  ]

  let count = 0
  for (const pattern of patterns) {
    const matches = content.match(pattern)
    if (matches) {
      count += matches.length
    }
  }

  return count
}

/**
 * Check if content includes specific imports
 *
 * @param content - Source code content
 * @param module - Module name to check
 * @returns True if module is imported
 *
 * @example
 * ```typescript
 * const usesZod = hasImportFrom(sourceCode, 'zod')
 * const usesContracts = hasImportFrom(sourceCode, '@revealui/contracts')
 * ```
 */
export function hasImportFrom(content: string, module: string): boolean {
  return content.includes(`from '${module}'`) || content.includes(`from "${module}"`)
}
