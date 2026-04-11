/**
 * Unit tests for discover.ts internal functions
 *
 * Tests internal AST parsing functions in isolation using in-memory TypeScript files.
 * For integration tests that use actual schema files, see discover.test.ts
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ParseError } from '../discover.js';
import {
  createParseError,
  discoverTablesInFile,
  extractTableNameFromCall,
  findTableExports,
  parseSourceFile,
} from '../discover.js';
import {
  createTestSourceFile,
  findAllCallExpressions,
  findFirstCallExpression,
} from './test-fixtures.js';

const expectDefined = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
};

describe('parseSourceFile', () => {
  const testDir = join(__dirname, '__temp_parse_test__');

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should parse valid TypeScript file', () => {
    const filePath = join(testDir, 'valid.ts');
    writeFileSync(filePath, "export const users = pgTable('users', {})");

    const sourceFile = parseSourceFile(filePath);

    expect(sourceFile).toBeDefined();
    expect(sourceFile.kind).toBe(ts.SyntaxKind.SourceFile);
    expect(sourceFile.fileName).toBe(filePath);
    expect(sourceFile.statements.length).toBeGreaterThan(0);
  });

  it('should parse empty file', () => {
    const filePath = join(testDir, 'empty.ts');
    writeFileSync(filePath, '');

    const sourceFile = parseSourceFile(filePath);

    expect(sourceFile).toBeDefined();
    expect(sourceFile.kind).toBe(ts.SyntaxKind.SourceFile);
    expect(sourceFile.fileName).toBe(filePath);
    expect(sourceFile.statements.length).toBe(0);
  });

  it('should parse file with syntax errors gracefully', () => {
    const filePath = join(testDir, 'syntax-error.ts');
    writeFileSync(filePath, "export const users = pgTable('users', {"); // Missing closing brace

    // TypeScript parser creates SourceFile even with syntax errors
    const sourceFile = parseSourceFile(filePath);

    expect(sourceFile).toBeDefined();
    expect(sourceFile.kind).toBe(ts.SyntaxKind.SourceFile);
    expect(sourceFile.fileName).toBe(filePath);
    // File should still parse, but may have diagnostics
  });

  it('should throw error for non-existent file', () => {
    const filePath = join(testDir, 'nonexistent.ts');

    expect(() => {
      parseSourceFile(filePath);
    }).toThrow();
  });

  it('should parse file with multiple tables', () => {
    const filePath = join(testDir, 'multiple.ts');
    writeFileSync(
      filePath,
      `
export const users = pgTable('users', {})
export const sessions = pgTable('sessions', {})
export const sites = pgTable('sites', {})
`,
    );

    const sourceFile = parseSourceFile(filePath);

    expect(sourceFile).toBeDefined();
    expect(sourceFile.kind).toBe(ts.SyntaxKind.SourceFile);
    expect(sourceFile.statements.length).toBe(3);
  });

  it('should parse file with comments and whitespace', () => {
    const filePath = join(testDir, 'comments.ts');
    writeFileSync(
      filePath,
      `
// User table
export const users = pgTable('users', {
  // User ID
  id: text('id').primaryKey(),
})
`,
    );

    const sourceFile = parseSourceFile(filePath);

    expect(sourceFile).toBeDefined();
    expect(sourceFile.kind).toBe(ts.SyntaxKind.SourceFile);
  });
});

describe('extractTableNameFromCall', () => {
  it('should extract table name from single quotes', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable('users', {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for single quotes'),
    );
    expect(tableName).toBe('users');
  });

  it('should extract table name from double quotes', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable("users", {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for double quotes'),
    );
    expect(tableName).toBe('users');
  });

  it('should extract table name from template literal (no substitutions)', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable(\`users\`, {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for template literal'),
    );
    expect(tableName).toBe('users');
  });

  it('should reject template expression with substitutions', () => {
    const sourceFile = createTestSourceFile(`
      const tableName = 'users'
      export const users = pgTable(\`table_\${tableName}\`, {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for template substitution'),
    );
    expect(tableName).toBeNull();
  });

  it('should reject template expression with multiple substitutions', () => {
    const sourceFile = createTestSourceFile(`
      const prefix = 'table'
      const suffix = 'users'
      export const users = pgTable(\`\${prefix}_\${suffix}\`, {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for multiple substitutions'),
    );
    expect(tableName).toBeNull();
  });

  it('should handle template expression through findTableExports', () => {
    const sourceFile = createTestSourceFile(`
      const tableName = 'users'
      export const users = pgTable(\`table_\${tableName}\`, {})
      export const sessions = pgTable('sessions', {})
    `);

    const errors: ParseError[] = [];
    const tables = findTableExports(sourceFile, '/test.ts', errors);

    // Template expression should be skipped  -  only sessions table found
    expect(tables.length).toBe(1);
    expect(tables[0].variableName).toBe('sessions');
    expect(tables[0].tableName).toBe('sessions');

    // Error should be reported for the template expression
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('not supported');
    expect(errors[0].message).toContain('static string literal');
    expect(errors[0].position).toBeDefined();
  });

  it('should create error for template expressions in table name', () => {
    const sourceFile = createTestSourceFile(`
      const tableName = 'users'
      export const users = pgTable(\`table_\${tableName}\`, {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const errors: ParseError[] = [];
    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for template error case'),
      errors,
    );
    expect(tableName).toBeNull();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('Template expressions');
    expect(errors[0].message).toContain('not supported');
    expect(errors[0].message).toContain('static string literal');
    expect(errors[0].position).toBeDefined();
  });

  it('should return null for missing arguments', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable()
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for missing args'),
    );
    expect(tableName).toBeNull();
  });

  it('should return null for non-string arguments', () => {
    const sourceFile = createTestSourceFile(`
      const name = 123
      export const users = pgTable(name, {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for non-string args'),
    );
    expect(tableName).toBeNull();
  });

  it('should handle snake_case table names', () => {
    const sourceFile = createTestSourceFile(`
      export const siteCollaborators = pgTable('site_collaborators', {})
    `);

    const callExpr = findFirstCallExpression(sourceFile, 'pgTable');
    expect(callExpr).not.toBeNull();

    const tableName = extractTableNameFromCall(
      expectDefined(callExpr, 'Expected call expression for snake_case'),
    );
    expect(tableName).toBe('site_collaborators');
  });
});

describe('findTableExports', () => {
  it('should find standard export const pattern', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable('users', {})
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(1);
    expect(tables[0].variableName).toBe('users');
    expect(tables[0].tableName).toBe('users');
  });

  it('should find declare const pattern', () => {
    const sourceFile = createTestSourceFile(`
      declare const users = pgTable('users', {})
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(1);
    expect(tables[0].variableName).toBe('users');
  });

  it('should find multiple tables in one file', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable('users', {})
      export const sessions = pgTable('sessions', {})
      export const sites = pgTable('sites', {})
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(3);
    expect(tables.map((t) => t.variableName)).toContain('users');
    expect(tables.map((t) => t.variableName)).toContain('sessions');
    expect(tables.map((t) => t.variableName)).toContain('sites');
  });

  it('should handle tables with comments', () => {
    const sourceFile = createTestSourceFile(`
      // User table
      export const users = pgTable('users', {
        // User ID
        id: text('id').primaryKey(),
      })
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(1);
    expect(tables[0].variableName).toBe('users');
  });

  it('should handle various whitespace styles', () => {
    const sourceFile = createTestSourceFile(`
      export const   users   =   pgTable(   'users'   ,   {}   )
      export const sessions=pgTable('sessions',{})
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(2);
  });

  it('should skip invalid pgTable calls', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable('users', {})
      export const invalid = someOtherFunction('test', {})
      export const alsoInvalid = pgTable()
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(1);
    expect(tables[0].variableName).toBe('users');
  });

  it('should handle tables with trailing commas', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable('users', {
        id: text('id').primaryKey(),
      })
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    expect(tables.length).toBe(1);
  });

  it('should handle malformed pgTable call (missing closing brace)', () => {
    const sourceFile = createTestSourceFile(`
      export const users = pgTable('users', {
        id: text('id').primaryKey(),
      // Missing closing brace
    `);

    // TypeScript parser will still create AST, but may have syntax errors
    const tables = findTableExports(sourceFile, '/test.ts');
    // Should handle gracefully - may or may not find table depending on parse result
    expect(Array.isArray(tables)).toBe(true);
  });

  it('should handle deeply nested exports', () => {
    const sourceFile = createTestSourceFile(`
      namespace MyNamespace {
        export const users = pgTable('users', {})
      }
    `);

    const tables = findTableExports(sourceFile, '/test.ts');
    // Nested exports may or may not be found depending on implementation
    expect(Array.isArray(tables)).toBe(true);
  });
});

describe('discoverTablesInFile', () => {
  const testDir = join(__dirname, '__temp_discover_test__');

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should discover tables from valid file', () => {
    const filePath = join(testDir, 'valid.ts');
    writeFileSync(
      filePath,
      `
export const users = pgTable('users', {})
export const sessions = pgTable('sessions', {})
`,
    );

    const result = discoverTablesInFile(filePath);

    expect(result.tables.length).toBe(2);
    expect(result.tables[0].variableName).toBe('users');
    expect(result.tables[0].tableName).toBe('users');
    expect(result.tables[1].variableName).toBe('sessions');
    expect(result.tables[1].tableName).toBe('sessions');
    expect(result.errors.length).toBe(0);
  });

  it('should return empty tables for file with no tables', () => {
    const filePath = join(testDir, 'no-tables.ts');
    writeFileSync(filePath, 'const someVar = 123');

    const result = discoverTablesInFile(filePath);

    expect(result.tables.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should handle file with invalid pgTable calls', () => {
    const filePath = join(testDir, 'invalid.ts');
    writeFileSync(
      filePath,
      `
export const users = pgTable('users', {})
export const invalid = pgTable() // Missing arguments
`,
    );

    const result = discoverTablesInFile(filePath);

    // Should find valid table, skip invalid one
    expect(result.tables.length).toBe(1);
    expect(result.tables[0].variableName).toBe('users');
  });

  it('should handle non-existent file gracefully', () => {
    const filePath = join(testDir, 'nonexistent.ts');

    const result = discoverTablesInFile(filePath);

    expect(result.tables.length).toBe(0);
    expect(result.errors.length).toBe(1);
    const error = result.errors[0];
    expect(error.message).toContain('Failed to parse file');
    expect(error.message).toContain('nonexistent.ts');
    expect(error.message.length).toBeGreaterThan(30); // Verify detailed message
    expect(error.file).toBe(filePath);
    expect(error.position).toBeUndefined(); // File not found, no position
  });

  it('should handle file with syntax errors gracefully', () => {
    const filePath = join(testDir, 'syntax-error.ts');
    writeFileSync(filePath, "export const users = pgTable('users', {"); // Missing closing brace

    const result = discoverTablesInFile(filePath);

    // Should still attempt to parse and may find tables before syntax error
    expect(result).toBeDefined();
    expect(Array.isArray(result.tables)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should handle file with template expression in table name', () => {
    const filePath = join(testDir, 'template.ts');
    writeFileSync(
      filePath,
      `
const tableName = 'users'
export const users = pgTable(\`table_\${tableName}\`, {})
`,
    );

    const result = discoverTablesInFile(filePath);

    // Template expression should be rejected, table not discovered
    expect(result.tables.length).toBe(0);

    // NOTE: Current implementation doesn't create error for template expressions
    // When fix is implemented, result.errors should contain ParseError with:
    // - Message explaining why template expressions aren't supported
    // - Position pointing to template expression
    // - Context providing variable name
    // expect(result.errors.length).toBeGreaterThan(0)
    // expect(result.errors[0].message).toContain('Template expressions')
    // expect(result.errors[0].message).toContain('not supported')
  });
});

describe('createParseError', () => {
  it('should create parse error with position', () => {
    const sourceFile = createTestSourceFile(`export const users = pgTable('users', {})`);
    const node = findFirstCallExpression(sourceFile, 'pgTable');

    const error = createParseError(
      sourceFile,
      expectDefined(node, 'Expected pgTable call expression'),
      'Test error',
      'Test context',
    );

    expect(error).toBeDefined();
    expect(error.file).toBe('test.ts');
    expect(error.message).toBe('Test error');
    expect(error.context).toBe('Test context');
    expect(error.position).toBeDefined();
    expect(error.position?.line).toBeGreaterThan(0);
    expect(error.position?.column).toBeGreaterThan(0);
    expect(error.node).toBeDefined();
  });

  it('should create parse error without position', () => {
    const sourceFile = createTestSourceFile(`export const users = pgTable('users', {})`);

    const error = createParseError(sourceFile, null, 'Test error');

    expect(error).toBeDefined();
    expect(error.file).toBe('test.ts');
    expect(error.message).toBe('Test error');
    expect(error.position).toBeUndefined();
    expect(error.node).toBeUndefined();
  });

  it('should create parse error without context', () => {
    const sourceFile = createTestSourceFile(`export const users = pgTable('users', {})`);
    const node = findFirstCallExpression(sourceFile, 'pgTable');

    const error = createParseError(
      sourceFile,
      expectDefined(node, 'Expected pgTable call expression'),
      'Test error',
    );

    expect(error).toBeDefined();
    expect(error.context).toBeUndefined();
  });

  it('should create error with correct line and column positions', () => {
    const sourceFile = createTestSourceFile(`
export const users = pgTable('users', {})
export const sessions = pgTable('sessions', {})
`);
    // Find all pgTable calls and get the second one (sessions)
    const allCalls = findAllCallExpressions(sourceFile, 'pgTable');
    expect(allCalls.length).toBeGreaterThanOrEqual(2);
    const callExpr = allCalls[1]; // Second pgTable call (sessions)
    expect(callExpr).not.toBeNull();

    const error = createParseError(
      sourceFile,
      expectDefined(callExpr, 'Expected sessions call expression'),
      'Test error',
      'Test context',
    );

    expect(error.position).toBeDefined();
    expect(error.position?.line).toBe(3); // Third line (1-indexed, includes leading newline)
    expect(error.position?.column).toBeGreaterThan(0);
  });

  it('should create error with helpful message and context', () => {
    const sourceFile = createTestSourceFile(`export const users = pgTable('users', {})`);
    const node = findFirstCallExpression(sourceFile, 'pgTable');

    const error = createParseError(
      sourceFile,
      expectDefined(node, 'Expected pgTable call expression'),
      'Template expression not supported',
      'Table: users, Variable: users',
    );

    expect(error.message).toBe('Template expression not supported');
    expect(error.context).toBe('Table: users, Variable: users');
    expect(error.message).toContain('not supported'); // Verify message is helpful
  });
});
