/**
 * Test utilities for AST parsing unit tests
 *
 * Provides helpers for creating in-memory TypeScript files and traversing AST nodes.
 * This is separate from test-utils.ts which is for database integration tests.
 */

import * as ts from "typescript";

/**
 * Creates an in-memory TypeScript source file for testing
 */
export function createTestSourceFile(
	content: string,
	fileName = "test.ts",
): ts.SourceFile {
	return ts.createSourceFile(
		fileName,
		content,
		ts.ScriptTarget.Latest,
		true, // setParentNodes - needed for traversal
	);
}

/**
 * Finds the first call expression with the specified function name
 * Returns null if not found
 */
export function findFirstCallExpression(
	sourceFile: ts.SourceFile,
	functionName: string,
): ts.CallExpression | null {
	let result: ts.CallExpression | null = null;

	function visit(node: ts.Node) {
		if (result) return; // Already found

		if (ts.isCallExpression(node)) {
			if (ts.isIdentifier(node.expression)) {
				if (node.expression.text === functionName) {
					result = node;
					return;
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);
	return result;
}

/**
 * Finds all call expressions with the specified function name
 * Returns empty array if none found
 */
export function findAllCallExpressions(
	sourceFile: ts.SourceFile,
	functionName: string,
): ts.CallExpression[] {
	const results: ts.CallExpression[] = [];

	function visit(node: ts.Node) {
		if (ts.isCallExpression(node)) {
			if (ts.isIdentifier(node.expression)) {
				if (node.expression.text === functionName) {
					results.push(node);
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);
	return results;
}

/**
 * Finds the first variable declaration with the specified name
 * Returns null if not found
 */
export function findFirstVariableDeclaration(
	sourceFile: ts.SourceFile,
	varName: string,
): ts.VariableDeclaration | null {
	let result: ts.VariableDeclaration | null = null;

	function visit(node: ts.Node) {
		if (result) return; // Already found

		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				if (ts.isIdentifier(decl.name) && decl.name.text === varName) {
					result = decl;
					return;
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);
	return result;
}

/**
 * Gets the text representation of a node
 */
export function getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
	return node.getText(sourceFile);
}

/**
 * Finds the first property assignment with the specified property name
 * Returns null if not found
 */
export function findFirstPropertyAssignment(
	sourceFile: ts.SourceFile,
	propertyName: string,
): ts.PropertyAssignment | null {
	let result: ts.PropertyAssignment | null = null;

	function visit(node: ts.Node) {
		if (result) return; // Already found

		if (ts.isPropertyAssignment(node)) {
			if (ts.isIdentifier(node.name) && node.name.text === propertyName) {
				result = node;
				return;
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);
	return result;
}
