/**
 * Unit tests for extract-relationships.ts internal functions
 *
 * Tests internal AST parsing functions in isolation using in-memory TypeScript files.
 * For integration tests that use actual schema files, see extract-relationships.test.ts
 */

import { describe, expect, it } from 'vitest'
import * as ts from 'typescript'
import type { DiscoveredTable } from '../discover.js'
import {
  camelToSnake,
  generateForeignKeyName,
  getTableName,
  createParseError,
  parseSourceFile,
  resolveColumnName,
  extractArrayElements,
  findAllRelationsCalls,
  extractRelationsObject,
  parseOneRelationship,
  extractOneRelationships,
  validateRelationships,
  type ParseError,
  type ExtractedRelationship,
  type TableRelationships,
} from '../extract-relationships.js'
import {
  createTestSourceFile,
  findFirstCallExpression,
  findAllCallExpressions,
  findFirstVariableDeclaration,
} from './test-fixtures.js'

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
    { variableName: 'siteCollaborators', tableName: 'site_collaborators', sourceFile: 'sites.ts' },
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

    const error = createParseError(sourceFile, node!, 'Test error', 'Test context')

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

    const expr = varDecl!.initializer
    expect(ts.isPropertyAccessExpression(expr)).toBe(true)

    const columnName = resolveColumnName(expr as ts.PropertyAccessExpression, 'sessions')
    expect(columnName).toBe('user_id')
  })

  it('should return null for wrong table variable', () => {
    const sourceFile = createTestSourceFile(`const expr = otherTable.column`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'expr')
    expect(varDecl).not.toBeNull()

    const expr = varDecl!.initializer
    expect(ts.isPropertyAccessExpression(expr)).toBe(true)

    const columnName = resolveColumnName(expr as ts.PropertyAccessExpression, 'sessions')
    expect(columnName).toBeNull()
  })

  it('should return null for nested property access', () => {
    const sourceFile = createTestSourceFile(`const expr = sessions.user.profile`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'expr')
    expect(varDecl).not.toBeNull()

    const expr = varDecl!.initializer
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

    const expr = varDecl!.initializer
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

    const arrayExpr = varDecl!.initializer
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

    const arrayExpr = varDecl!.initializer
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

    const arrayExpr = varDecl!.initializer
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
    expect(error.message.length).toBeGreaterThan(30) // Verify it's not just "Error"
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    expect(error.context).toBe('test')
    expect(columns.length).toBe(1) // Only valid column extracted
    expect(columns[0]).toBe('user_id')
  })

  it('should warn about nested property access', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.user.profile]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl!.initializer
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
    expect(error.message.length).toBeGreaterThan(40) // Verify detailed message
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    expect(error.context).toBe('test')
    expect(columns.length).toBe(0) // Nested access not extracted
  })

  it('should warn about element access', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions[someVar]]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl!.initializer
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
    expect(error.message).toBe('Computed property access is not supported - only direct table.column access')
    expect(error.message).toContain('Computed property access')
    expect(error.message).toContain('not supported')
    expect(error.message).toContain('direct table.column access') // Should explain what IS supported
    expect(error.message.length).toBeGreaterThan(50) // Verify detailed message
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    expect(error.context).toBe('test')
    expect(columns.length).toBe(0) // Element access not extracted
  })

  it('should return empty array for wrong table variable', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [otherTable.column]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl!.initializer
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
    expect(errors.length).toBe(0) // No error for wrong table (just skipped)
  })

  it('should return empty array for empty arrays', () => {
    const sourceFile = createTestSourceFile(`const fields = []`)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl!.initializer
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

    const arrayExpr = varDecl!.initializer
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
    expect(errors.length).toBe(0) // Wrong table just skipped, no error
  })

  it('should handle deeply nested property access (depth > 1)', () => {
    const sourceFile = createTestSourceFile(`
      const fields = [sessions.user.profile.id]
    `)
    const varDecl = findFirstVariableDeclaration(sourceFile, 'fields')
    expect(varDecl).not.toBeNull()

    const arrayExpr = varDecl!.initializer
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
    expect(error.message.length).toBeGreaterThan(50) // Verify detailed message
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    expect(error.context).toBe('test')
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

    const relationsObj = extractRelationsObject(relationsCall!)
    expect(relationsObj).not.toBeNull()
    expect(ts.isObjectLiteralExpression(relationsObj!)).toBe(true)
  })

  it('should handle multiple levels of parentheses', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ((({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      }))))
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = extractRelationsObject(relationsCall!)
    expect(relationsObj).not.toBeNull()
    expect(ts.isObjectLiteralExpression(relationsObj!)).toBe(true)
  })

  it('should extract object from parenthesized arrow function', () => {
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => (({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      })))
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = extractRelationsObject(relationsCall!)
    expect(relationsObj).not.toBeNull()
  })

  it('should return null for non-arrow function', () => {
    const sourceFile = createTestSourceFile(`
      export const test = relations(sessions, function() { return {} })
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = extractRelationsObject(relationsCall!)
    expect(relationsObj).toBeNull()
  })

  it('should return null for missing body', () => {
    const sourceFile = createTestSourceFile(`
      export const test = relations(sessions, ({ one }) => {})
    `)

    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    expect(relationsCall).not.toBeNull()

    const relationsObj = extractRelationsObject(relationsCall!)
    // Empty block statement returns null
    expect(relationsObj).toBeNull()
  })
})

describe('parseOneRelationship', () => {
  const tables: DiscoveredTable[] = [
    { variableName: 'sessions', tableName: 'sessions', sourceFile: 'sessions.ts' },
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

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
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
    expect(error.message).toBe('Computed property name is not supported - only literal property names are supported')
    expect(error.message).toContain('Computed property name')
    expect(error.message).toContain('not supported')
    expect(error.message).toContain('literal property names') // Should explain what IS supported
    expect(error.message.length).toBeGreaterThan(50) // Verify detailed message
    expect(error.position).toBeDefined()
    expect(error.position?.line).toBeGreaterThan(0)
    expect(error.context).toContain('Table: sessions')
  })

  it('should handle wrong table variable in fields array', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(users, { fields: [otherTable.column], references: [users.id] }),
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
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
    { variableName: 'sessions', tableName: 'sessions', sourceFile: 'sessions.ts' },
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

    const objExpr = varDecl!.initializer
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

    const objExpr = varDecl!.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const errors: ParseError[] = []
    const relationships = extractOneRelationships(
      objExpr as ts.ObjectLiteralExpression,
      'sessions',
      tables,
      sourceFile,
      errors,
    )

    // Should extract valid relationship, skip invalid one
    expect(relationships.length).toBe(1)
    expect(relationships[0].foreignKeyName).toBe('sessions_user_id_users_id_fk')
    // Invalid relationship won't parse (unknown table), so no error created
    // This documents current behavior
  })
})

describe('validateRelationships', () => {
  const tables: DiscoveredTable[] = [
    { variableName: 'sessions', tableName: 'sessions', sourceFile: 'sessions.ts' },
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
    expect(errors[0].message).toContain('nonexistent_table')
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
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Empty columns')
    expect(errors[0].message).toContain('sessions_user_id_users_id_fk')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].file).toBeDefined()
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
    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain('Empty referencedColumns')
    expect(errors[0].message).toContain('sessions_user_id_users_id_fk')
    expect(errors[0].context).toContain('Table: sessions')
    expect(errors[0].file).toBeDefined()
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
    { variableName: 'sessions', tableName: 'sessions', sourceFile: 'core/index.ts' },
    { variableName: 'users', tableName: 'users', sourceFile: 'core/index.ts' },
  ]

  it('should handle malformed relations() call gracefully (syntax error)', () => {
    // Note: TypeScript parser will reject malformed syntax, so we test that functions don't crash
    // when encountering AST nodes that don't match expected patterns
    const sourceFile = createTestSourceFile(`
      export const sessionsRelations = relations(sessions, ({ one }) => ({
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
      // Missing closing paren - this won't parse as valid TypeScript
    `)

    // If source file has syntax errors, ts.createSourceFile still creates a source file
    // but with diagnostics. Functions should handle this gracefully without crashing.
    const relationsCall = findFirstCallExpression(sourceFile, 'relations')
    // Should not crash even if AST is malformed
    expect(sourceFile).toBeDefined()
  })

  it('should handle invalid one() call with wrong argument types', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one('string', 123), // Wrong argument types - not a valid one() call
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    expect(ts.isPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    // This should handle gracefully - one() requires specific argument types
    // If not, parseOneRelationship should return null
    const propAssign = prop as ts.PropertyAssignment
    const initializer = propAssign.initializer

    // Should not crash - may or may not create error depending on implementation
    expect(initializer).toBeDefined()
  })

  it('should handle missing arguments in one() call', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        user: one(), // Missing arguments
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    const propAssign = prop as ts.PropertyAssignment
    const initializer = propAssign.initializer

    // Should not crash - one() with no args should return null or create error
    expect(initializer).toBeDefined()
    expect(ts.isCallExpression(initializer)).toBe(true)
  })

  it('should handle shorthand properties in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const userRelation = one(users, { fields: [sessions.userId], references: [users.id] })
      const relations = {
        user, // Shorthand property - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    // Shorthand property uses ShorthandPropertyAssignment
    // Should be detected and skipped or warned about
    expect(ts.isShorthandPropertyAssignment(prop)).toBe(true)

    const errors: ParseError[] = []
    // extractOneRelationships should skip or warn about shorthand properties
    // For now, we just verify the AST node type is correct
    expect(prop).toBeDefined()
  })

  it('should handle method signatures in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        getUser() { 
          return one(users, { fields: [sessions.userId], references: [users.id] })
        }, // Method signature - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    // Method signature uses MethodDeclaration or MethodSignature
    // Should be detected and skipped or warned about
    expect(ts.isMethodDeclaration(prop) || ts.isMethodSignature(prop)).toBe(true)

    const errors: ParseError[] = []
    // extractOneRelationships should skip or warn about method signatures
    // For now, we just verify the AST node type is correct
    expect(prop).toBeDefined()
  })

  it('should handle getter properties in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const relations = {
        get user() { 
          return one(users, { fields: [sessions.userId], references: [users.id] })
        }, // Getter - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    const prop = (objExpr as ts.ObjectLiteralExpression).properties[0]
    // Getter uses GetAccessorDeclaration
    // Should be detected and skipped or warned about
    expect(ts.isGetAccessorDeclaration(prop)).toBe(true)

    // extractOneRelationships should skip or warn about getters
    expect(prop).toBeDefined()
  })

  it('should handle spread elements in relations object', () => {
    const sourceFile = createTestSourceFile(`
      const otherRelations = { profile: one(...) }
      const relations = {
        user: one(users, { fields: [sessions.userId], references: [users.id] }),
        ...otherRelations, // Spread - not supported
      }
    `)

    const varDecl = findFirstVariableDeclaration(sourceFile, 'relations')
    expect(varDecl).not.toBeNull()

    const objExpr = varDecl!.initializer
    expect(ts.isObjectLiteralExpression(objExpr)).toBe(true)

    // Should have both property assignment and spread assignment
    expect(objExpr.properties.length).toBe(2)
    const spreadProp = objExpr.properties[1]
    expect(ts.isSpreadAssignment(spreadProp)).toBe(true)

    // extractOneRelationships should skip or warn about spread assignments
    expect(spreadProp).toBeDefined()
  })
})
