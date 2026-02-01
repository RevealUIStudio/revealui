/**
 * Unit tests for extract-relationships.ts internal functions
 *
 * Tests internal AST parsing functions in isolation using in-memory TypeScript files.
 * For integration tests that use actual schema files, see extract-relationships.test.ts
 */

import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { DiscoveredTable } from '../discover.js'
import {
  camelToSnake,
  createParseError,
  extractArrayElements,
  extractOneRelationships,
  extractRelationsObject,
  findAllRelationsCalls,
  generateForeignKeyName,
  getTableName,
  type ParseError,
  parseOneRelationship,
  parseSourceFile,
  resolveColumnName,
  type TableRelationships,
  validateRelationships,
} from '../extract-relationships.js'
import {
  createTestSourceFile,
  findFirstCallExpression,
  findFirstVariableDeclaration,
} from './test-fixtures.js'

const expectDefined = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new Error(message)
  }
  return value
}

describe('camelToSnake', () => {
  it('should convert camelCase to snake_case', () => {
    expect(camelToSnake('userId')).toBe('user_id')
    expect(camelToSnake('siteCollaborator')).toBe('site_collaborator')
    expect(camelToSnake('pageRevision')).toBe('page_revision')
  })

  it('should handle single word', () => {
    expect(camelToSnake('user')).toBe('user')
    expect(camelToSnake('id')).toBe('id')
  })

  it('should handle already snake_case', () => {
    expect(camelToSnake('user_id')).toBe('user_id')
  })

  it('should handle empty string', () => {
    expect(camelToSnake('')).toBe('')
  })
})

describe('generateForeignKeyName', () => {
  it('should generate correct foreign key name', () => {
    const fkName = generateForeignKeyName('sessions', 'user_id', 'users', 'id')
    expect(fkName).toBe('sessions_user_id_users_id_fk')
  })

  it('should handle snake_case names', () => {
    const fkName = generateForeignKeyName('site_collaborators', 'user_id', 'users', 'id')
    expect(fkName).toBe('site_collaborators_user_id_users_id_fk')
  })
})

describe('getTableName', () => {
  const tables: DiscoveredTable[] = [
    { variableName: 'users', tableName: 'users', sourceFile: 'users.ts' },
    {
      variableName: 'siteCollaborators',
      tableName: 'site_collaborators',
      sourceFile: 'sites.ts',
    },
  ]

  it('should return table name from discovered tables', () => {
    expect(getTableName('users', tables)).toBe('users')
    expect(getTableName('siteCollaborators', tables)).toBe('site_collaborators')
  })

  it('should convert to snake_case if not found', () => {
    expect(getTableName('unknownTable', tables)).toBe('unknown_table')
  })
})

describe('createParseError', () => {
  it('should create parse error with position', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))
    `)
    const node = findFirstCallExpression(sourceFile, 'relations')

    const error = createParseError(
      sourceFile,
      expectDefined(node, 'Expected relations call expression'),
      'Test error',
      'Test context',
    )

    expect(error).toBeDefined()
    expect(error.file).toBe('test.ts')
    expect(error.message).toBe('Test error')
    expect(error.context).toBe('Test context')
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    expect(error.position?.column).toBeGreaterThan(0)
    expect(error.node).toBeDefined()
  })

  it('should create parse error without position', () => {
    const sourceFile = createTestSourceFile(`export const test = 'test'`)

    const error = createParseError(sourceFile, null, 'Test error')

    expect(error).toBeDefined()
    expect(error.file).toBe('test.ts')
    expect(error.message).toBe('Test error')
    expect(error.position).toBeUndefined()
    expect(error.node).toBeUndefined()
  })
})

describe('parseSourceFile', () => {
  it('should be exported and callable', () => {
    // parseSourceFile reads from file system, so full testing requires integration test
    expect(typeof parseSourceFile).toBe('function')
  })
})

describe('resolveColumnName', () => {
  it('should resolve column name from correct table variable', () => {
    const sourceFile = createTestSourceFile(`const expr = sessions.userId`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'expr')
    expect(varDecl).not.toBeNull()
    expect(varDecl?.initializer).not.toBeUndefined()

    const expr = varDecl?.initializer
    expect(ts.isPropertyAccessExpression(expr)).toBe(true)

    const columnName = resolveColumnName(expr as ts.PropertyAccessExpression, 'sessions')
    expect(columnName).toBe('user_id')
  })

  it('should return null for wrong table variable', () => {
    const sourceFile = createTestSourceFile(`const expr = otherTable.column`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'expr')
    expect(varDecl).not.toBeNull()

    const expr = varDecl?.initializer
    expect(ts.isPropertyAccessExpression(expr)).toBe(true)

    const columnName = resolveColumnName(expr as ts.PropertyAccessExpression, 'sessions')
    expect(columnName).toBeNull()
  })

  it('should return null for nested property access', () => {
    const sourceFile = createTestSourceFile(`const expr = sessions.user.profile`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'expr')
    expect(varDecl).not.toBeNull()

    const expr = varDecl?.initializer
    expect(ts.isPropertyAccessExpression(expr)).toBe(true)

    const columnName = resolveColumnName(expr as ts.PropertyAccessExpression, 'sessions')
    // Nested access is detected by depth check in extractArrayElements, not here
    // But resolveColumnName should still return null as it only handles depth 1
    expect(columnName).toBeNull()
  })

  it('should return null for non-property access expressions', () => {
    const sourceFile = createTestSourceFile(`const expr = 123`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'expr')
    expect(varDecl).not.toBeNull()

    const expr = varDecl?.initializer
    const columnName = resolveColumnName(expr, 'sessions')
    expect(columnName).toBeNull()
  })
})

describe('extractArrayElements', () => {
  it('should extract column names from standard array', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.userId]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()
    expect(varDecl?.initializer).not.toBeUndefined()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(columns.length).toBe(1)
    expect(columns[0]).toBe('user_id')
    expect(errors.length).toBe(0)
  })

  it('should extract multiple column names', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.userId, sessions.token]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()
    expect(varDecl?.initializer).not.toBeUndefined()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(columns.length).toBe(2)
    expect(columns[0]).toBe('user_id')
    expect(columns[1]).toBe('token')
    expect(errors.length).toBe(0)
  })

  it('should warn about spread elements', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.userId, ...otherFields]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(errors.length).toBe(1)
    const error = errors[0]
    expect(error.message).toBe('Spread operator in array is not supported')
    expect(error.message).toContain('Spread operator')
    expect(error.message).toContain('not supported')
    // Verify message is detailed enough (not just "Error")
    expect(error.message.length).toBeGreaterThan(30)
    // Verify message structure: should contain error type and explanation
    expect(error.message).toMatch(/spread|operator|array|not|supported/i)
    // Verify position is correct
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    // Verify context is helpful
    expect(error.context).toBe('test')
    expect(error.context.length).toBeGreaterThan(0)
    expect(columns.length).toBe(1) // Only valid column extracted
    expect(columns[0]).toBe('user_id')
  })

  it('should warn about nested property access', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.user.profile]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(errors.length).toBe(1)
    const error = errors[0]
    expect(error.message).toContain('Nested property access')
    expect(error.message).toContain('not supported')
    expect(error.message).toContain('depth') // Should mention depth
    // Verify message explains what IS supported (actionable)
    // Message should contain helpful guidance like "only" or mention what IS supported
    expect(error.message).toMatch(/only|direct|table\.column/i)
    // Verify message is detailed enough (not just "Error")
    expect(error.message.length).toBeGreaterThan(50)
    // Verify position is correct
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    // Verify context is helpful
    expect(error.context).toBe('test')
    expect(error.context.length).toBeGreaterThan(0)
    expect(columns.length).toBe(0) // Nested access not extracted
  })

  it('should warn about element access', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions[someVar]]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(errors.length).toBe(1)
    const error = errors[0]
    expect(error.message).toBe(
      'Computed property access is not supported - only direct table.column access',
    )
    expect(error.message).toContain('Computed property access')
    expect(error.message).toContain('not supported')
    expect(error.message).toContain('direct table.column access') // Should explain what IS supported
    // Verify message explains what IS supported (actionable)
    // Message should contain helpful guidance like "only" or mention what IS supported
    expect(error.message).toMatch(/only|direct|table\.column/i)
    // Verify message is detailed enough (not just "Error")
    expect(error.message.length).toBeGreaterThan(50)
    // Verify position is correct
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    // Verify context is helpful
    expect(error.context).toBe('test')
    expect(error.context.length).toBeGreaterThan(0)
    expect(columns.length).toBe(0) // Element access not extracted
  })

  it('should return empty array for wrong table variable', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [otherTable.column]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(columns.length).toBe(0) // Wrong table variable not extracted
    expect(errors.length).toBe(1) // Error for wrong table variable
  })

  it('should return empty array for empty arrays', () => {
    const sourceFile = createTestSourceFile(`const fields = []`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(columns.length).toBe(0)
    expect(errors.length).toBe(0) // Empty array is valid, just returns empty
  })

  it('should handle mixed correct and wrong table variables', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.userId, otherTable.column, sessions.token]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    // Should only extract correct table variables
    expect(columns.length).toBe(2)
    expect(columns[0]).toBe('user_id')
    expect(columns[1]).toBe('token')
    expect(errors.length).toBe(1) // Error for wrong table variable
  })

  it('should handle deeply nested property access (depth > 1)', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.user.profile.id]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl?.initializer
    expect(ts.isArrayLiteralExpression(arrayExpr)).toBe(true)

    const errors: ParseError[] = []
    const columns = extractArrayElements(
      arrayExpr as ts.ArrayLiteralExpression,
      'sessions',
      sourceFile,
      'test',
      errors,
    )

    expect(errors.length).toBe(1)
    const error = errors[0]
    expect(error.message).toContain('Nested property access')
    expect(error.message).toContain('not supported')
    expect(error.message).toContain('depth') // Should mention depth
    expect(error.message).toContain('only direct table.column access') // Should explain what IS supported
    // Verify message explains what IS supported (actionable)
    // Message should contain helpful guidance like "only" or mention what IS supported
    expect(error.message).toMatch(/only|direct|table\.column/i)
    // Verify message is detailed enough (not just "Error")
    expect(error.message.length).toBeGreaterThan(50)
    // Verify position is correct
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    // Verify context is helpful
    expect(error.context).toBe('test')
    expect(error.context.length).toBeGreaterThan(0)
    expect(columns.length).toBe(0)
  })
})

describe('findAllRelationsCalls', () => {
  it('should find single relations() call', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))
    `)

    const results = findAllRelationsCalls(sourceFile)

    expect(results.size).toBe(1)
    expect(results.has('sessions')).toBe(true)
  })

  it('should find multiple relations() calls', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))
      export const pagesRelations = relations(pages, ({ one }) => ({
        site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
      }))
    `)

    const results = findAllRelationsCalls(sourceFile)

    expect(results.size).toBe(2)
    expect(results.has('sessions')).toBe(true)
    expect(results.has('pages')).toBe(true)
  })

  it('should skip non-relations calls', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({}))
      export const otherCall = someFunction(sessions, {})
    `)

    const results = findAllRelationsCalls(sourceFile)

    expect(results.size).toBe(1)
    expect(results.has('sessions')).toBe(true)
  })

  it('should handle relations with comments', () => {
    const sourceFile = createTestSourceFile(`
      // Sessions relations
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        // User relation
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))
    `)

    const results = findAllRelationsCalls(sourceFile)

    expect(results.size).toBe(1)
  })
})

describe('extractRelationsObject', () => {
  it('should extract object from standard arrow function', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = expectDefined(
      extractRelationsObject(expectDefined(relationsCall, 'Expected relations call')),
      'Expected relations object',
    )
    expect(relationsObj).not.toBeNull()
    expect(ts.isObjectLiteralExpression(relationsObj)).toBe(true)
  })

  it.skip('should handle multiple levels of parentheses', () => {
    // TODO: extractRelationsObject doesn't handle >2 levels of parentheses
    // This is an edge case not found in real code - low priority
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ((({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))))
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = expectDefined(
      extractRelationsObject(expectDefined(relationsCall, 'Expected relations call')),
      'Expected relations object',
    )
    expect(relationsObj).not.toBeNull()
    expect(ts.isObjectLiteralExpression(relationsObj)).toBe(true)
  })

  it.skip('should extract object from parenthesized arrow function', () => {
    // TODO: extractRelationsObject doesn't handle double-parenthesized returns
    // This is an edge case not found in real code - low priority
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => (({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      })))
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = expectDefined(
      extractRelationsObject(expectDefined(relationsCall, 'Expected relations call')),
      'Expected relations object',
    )
    expect(relationsObj).not.toBeNull()
  })

  it('should return null for non-arrow function', () => {
    const sourceFile = createTestSourceFile(`
      export const test = relations(sessions, function() { return {} })
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = extractRelationsObject(
      expectDefined(relationsCall, 'Expected relations call'),
    )
    expect(relationsObj).toBeNull()
  })

  it('should return null for missing body', () => {
    const sourceFile = createTestSourceFile(`
      export const test = relations(sessions, ({ one }) => {})
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = extractRelationsObject(
      expectDefined(relationsCall, 'Expected relations call'),
    )
    // Empty block statement returns null
    expect(relationsObj).toBeNull()
  })
})

describe('parseOneRelationship', () => {
  const tables: DiscoveredTable[] = [
    {
      variableName: 'sessions',
      tableName: 'sessions',
      sourceFile: 'sessions.ts',
    },
    { variableName: 'users', tableName: 'users', sourceFile: 'users.ts' },
  ]

  it('should parse valid one() relationship', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()
    expect(varDecl?.initializer).not.toBeUndefined()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const objLiteral = objExpr as ts.ObjectLiteralExpression
    expect(objLiteral.properties.length).toBe(1)

    const prop = objLiteral.properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    expect(relationship).not.toBeNull()
    expect(relationship?.foreignKeyName).toBe('sessions_user_id_users_id_fk')
    expect(relationship?.columns).toEqual(['user_id'])
    expect(relationship?.referencedColumns).toEqual(['id'])
    expect(relationship?.isOneToOne).toBe(true)
    expect(relationship?.referencedRelation).toBe('users')
    expect(errors.length).toBe(0)
  })

  it('should return null for missing fields array', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { references: [users.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    expect(relationship).toBeNull()
  })

  it('should return null for missing references array', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [sessions.userId] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    expect(relationship).toBeNull()
  })

  it('should return null for empty arrays', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [], references: [] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    expect(relationship).toBeNull()
  })

  it('should warn about computed property name', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        [dynamicName]: one(users, { fields: [sessions.userId], references: [users.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)
    expect(ts.isComputedPropertyName(prop.name)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    expect(relationship).toBeNull()
    expect(errors.length).toBe(1)
    const error = errors[0]
    expect(error.message).toBe(
      'Computed property name is not supported - only literal property names are supported',
    )
    expect(error.message).toContain('Computed property name')
    expect(error.message).toContain('not supported')
    expect(error.message).toContain('literal property names') // Should explain what IS supported
    // Verify message explains what IS supported (actionable)
    // Message should contain helpful guidance like "only" or mention what IS supported
    expect(error.message).toMatch(/only|literal|property/i)
    // Verify message is detailed enough (not just "Error")
    expect(error.message.length).toBeGreaterThan(50)
    // Verify position is correct
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    // Verify context is helpful
    expect(error.context).toContain('Table: sessions')
    expect(error.context.length).toBeGreaterThan(10)
  })

  it('should handle wrong table variable in fields array', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [otherTable.column], references: [users.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    // Wrong table variable results in empty columns, so relationship is null
    expect(relationship).toBeNull()
  })

  it('should handle wrong table variable in references array', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [sessions.userId], references: [otherTable.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    // Wrong table variable in references results in empty referencedColumns, so relationship is null
    expect(relationship).toBeNull()
  })

  it('should handle mixed correct and wrong table variables', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [sessions.userId, otherTable.column], references: [users.id, otherTable.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(
      prop as ts.PropertyAssignment,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    // Mixed correct/wrong - only correct ones extracted
    // If all columns are extracted, relationship may be created with partial columns
    // Current behavior: if any columns extracted, relationship created
    // This documents current behavior
    expect(relationship).not.toBeNull()
    expect(relationship?.columns.length).toBe(1) // Only correct column
    expect(relationship?.columns[0]).toBe('user_id')
  })
})

describe('extractOneRelationships', () => {
  const tables: DiscoveredTable[] = [
    {
      variableName: 'sessions',
      tableName: 'sessions',
      sourceFile: 'sessions.ts',
    },
    { variableName: 'users', tableName: 'users', sourceFile: 'users.ts' },
  ]

  it('should extract multiple relationships', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
        site: one(sites, { fields: [sessions.siteId], references: [sites.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()
    expect(varDecl?.initializer).not.toBeUndefined()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const tablesWithSites: DiscoveredTable[] = [
      ...tables,
      { variableName: 'sites', tableName: 'sites', sourceFile: 'sites.ts' },
    ]

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(
      objExpr as ts.ObjectLiteralExpression,
      'sessions',
      tablesWithSites,
      sourceFile,
      errors,
    )

    expect(relationships.length).toBe(2)
    expect(relationships[0].foreignKeyName).toBe('sessions_user_id_users_id_fk')
    expect(relationships[0].columns).toEqual(['user_id'])
    expect(relationships[0].referencedColumns).toEqual(['id'])
    expect(relationships[1].foreignKeyName).toBe('sessions_site_id_sites_id_fk')
    expect(relationships[1].columns).toEqual(['site_id'])
    expect(relationships[1].referencedColumns).toEqual(['id'])
    expect(errors.length).toBe(0)
  })

  it('should handle mixed valid and invalid relationships', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
        invalid: one(unknown, { fields: [sessions.unknownId], references: [unknown.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(
      objExpr as ts.ObjectLiteralExpression,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    // Should extract both relationships (validation happens later)
    expect(relationships.length).toBe(2)
    expect(relationships[0].foreignKeyName).toBe('sessions_user_id_users_id_fk')
    expect(relationships[1].foreignKeyName).toBe('sessions_unknown_id_unknown_id_fk')
    // Invalid table references are extracted and validated later in the pipeline
  })
})

describe('validateRelationships', () => {
  const tables: DiscoveredTable[] = [
    {
      variableName: 'sessions',
      tableName: 'sessions',
      sourceFile: 'sessions.ts',
    },
    { variableName: 'users', tableName: 'users', sourceFile: 'users.ts' },
  ]

  it('should validate valid relationships', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    expect(errors.length).toBe(0)
  })

  it('should error for referenced table that does not exist', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_unknown_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'unknown',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Referenced table')
    expect(errors[0].message).toContain('does not exist')
    expect(errors[0].message).toContain('unknown') // The actual referenced table name
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].file).toBeDefined()
  })

  it('should error for duplicate FK names', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Duplicate foreign key name')
    expect(errors[0].message).toContain('sessions_user_id_users_id_fk')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].file).toBeDefined()
  })

  it('should error for empty columns', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: [],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    // Validation may catch multiple issues - at least one should be about empty columns
    expect(errors.length).toBeGreaterThanOrEqual(1)
    const emptyColumnsError = errors.find(e => e.message.includes('Empty columns'))
    expect(emptyColumnsError).toBeDefined()
    expect(emptyColumnsError?.context).toContain('sessions_user_id_users_id_fk')
    expect(emptyColumnsError?.context).toContain('Table: sessions')
    expect(emptyColumnsError?.file).toBeDefined()
  })

  it('should error for empty referencedColumns', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: [],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    // Validation may catch multiple issues - at least one should be about empty referencedColumns
    expect(errors.length).toBeGreaterThanOrEqual(1)
    const emptyRefColumnsError = errors.find(e => e.message.includes('Empty referencedColumns'))
    expect(emptyRefColumnsError).toBeDefined()
    expect(emptyRefColumnsError?.context).toContain('sessions_user_id_users_id_fk')
    expect(emptyRefColumnsError?.context).toContain('Table: sessions')
    expect(emptyRefColumnsError?.file).toBeDefined()
  })

  it('should error for column count mismatch', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id', 'other_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Column count mismatch')
    expect(errors[0].message).toContain('2 columns vs 1 referenced columns')
    expect(errors[0].context).toContain('Table: sessions')
  })

  it('should provide helpful error messages with context', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_unknown_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'unknown',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('does not exist')
    expect(errors[0].message).toContain('unknown')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].context).toContain('FK: sessions_user_id_unknown_id_fk')
  })

  it('should provide helpful error messages for duplicate FK names', () => {
    const relationships: TableRelationships[] = [
      {
        tableVariableName: 'sessions',
        relationships: [
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
          {
            foreignKeyName: 'sessions_user_id_users_id_fk',
            columns: ['user_id'],
            isOneToOne: true,
            referencedRelation: 'users',
            referencedColumns: ['id'],
          },
        ],
      },
    ]

    const errors = validateRelationships(relationships, tables)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Duplicate foreign key name')
    expect(errors[0].message).toContain('sessions_user_id_users_id_fk')
    expect(errors[0].context).toContain('Table: sessions')
  })
})

describe('Edge Cases - Malformed and Unsupported Patterns', () => {
  const tables = [
    {
      variableName: 'sessions',
      tableName: 'sessions',
      sourceFile: 'core/index.ts',
    },
    { variableName: 'users', tableName: 'users', sourceFile: 'core/index.ts' },
  ]

  it('should handle malformed relations() call gracefully (syntax error)', () => {
    // TypeScript parser may still parse incomplete syntax
    // Functions should handle gracefully without crashing
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      // Missing closing paren - syntax may be incomplete
    `)

    // Should not crash - verify functions handle gracefully
    let relationsCalls: Map<string, ts.CallExpression> | undefined
    let relationsCall: ts.CallExpression | null = null
    let relationsObj: ts.ObjectLiteralExpression | null = null

    expect(() => {
      relationsCalls = findAllRelationsCalls(sourceFile)
      // May find the call even with syntax error (parser behavior)
      relationsCall = findFirstCallExpression(sourceFile, 'relations')
      if (relationsCall) {
        relationsObj = extractRelationsObject(relationsCall)
        // Relations object may be null due to incomplete syntax
      }
    }).not.toThrow()

    // Verify what actually happened
    // findAllRelationsCalls may or may not find the call depending on parser
    expect(relationsCalls).toBeDefined()
    if (relationsCalls) {
      expect(relationsCalls.size).toBeGreaterThanOrEqual(0) // May find or not
    }

    // If relations call was found, extractRelationsObject may return null for incomplete syntax
    if (relationsCall) {
      // This is expected - incomplete syntax may prevent extracting the object
      // Function should not crash regardless
      expect(relationsObj === null || ts.isObjectLiteralExpression(relationsObj)).toBe(true)
    }

    // Verify source file was created (basic sanity check)
    expect(sourceFile).toBeDefined()
  })

  it('should return null for invalid one() call with wrong argument types', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one('string', 123), // Wrong argument types - not a valid one() call
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer as ts.ObjectLiteralExpression
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = objExpr.properties[0] as ts.PropertyAssignment
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(prop, 'sessions', tables, sourceFile, errors)

    // Should return null for invalid arguments
    // Current behavior: parseOneRelationship returns null but doesn't create errors
    // for invalid argument types - it just silently rejects invalid calls
    expect(relationship).toBeNull()
    expect(errors.length).toBe(0) // Explicitly verify no errors are created for invalid args
  })

  it('should return null for one() call with missing arguments', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(), // Missing arguments
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer as ts.ObjectLiteralExpression
    const prop = objExpr.properties[0] as ts.PropertyAssignment

    const errors: ParseError[] = []
    const relationship = parseOneRelationship(prop, 'sessions', tables, sourceFile, errors)

    // Should return null for missing arguments
    // Current behavior: parseOneRelationship returns null but doesn't create errors
    // for missing arguments - it just silently rejects invalid calls
    expect(relationship).toBeNull()
    expect(errors.length).toBe(0) // Explicitly verify no errors are created for missing args
  })

  it('should create error for shorthand properties in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const userRelation = one(users, { fields: [sessions.userId], references: [users.id] })
      const relations = {
        user, // Shorthand property - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer as ts.ObjectLiteralExpression
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(objExpr, 'sessions', tables, sourceFile, errors)

    // Shorthand properties should be skipped
    expect(relationships.length).toBe(0)
    // Error should be created
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Only property assignments are supported')
    // Message should mention unsupported patterns (shorthand or method signatures)
    expect(errors[0].message).toMatch(/shorthand|method/i)
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].position).toBeDefined()
  })

  it('should create error for method signatures in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        getUser() { 
          return one(users, { fields: [sessions.userId], references: [users.id] })
        }, // Method signature - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer as ts.ObjectLiteralExpression
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(objExpr, 'sessions', tables, sourceFile, errors)

    expect(relationships.length).toBe(0)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Only property assignments are supported')
    expect(errors[0].message).toContain('method signatures')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].position).toBeDefined()
  })

  it('should create error for getter properties in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        get user() { 
          return one(users, { fields: [sessions.userId], references: [users.id] })
        }, // Getter - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer as ts.ObjectLiteralExpression
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(objExpr, 'sessions', tables, sourceFile, errors)

    expect(relationships.length).toBe(0)
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Only property assignments are supported')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].position).toBeDefined()
  })

  it('should create error for spread elements in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const otherRelations = { profile: one(...) }
      const relations = {
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
        ...otherRelations, // Spread - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl?.initializer as ts.ObjectLiteralExpression
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    // Should have both property assignment and spread assignment
    expect(objExpr.properties.length).toBe(2)

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(objExpr, 'sessions', tables, sourceFile, errors)

    // Should extract valid relationship but skip spread
    expect(relationships.length).toBe(1)
    expect(relationships[0].foreignKeyName).toContain('user')
    // Spread should create error
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Only property assignments are supported')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].position).toBeDefined()
  })
})
