# API Documentation Guide

This guide explains how to write API documentation using JSDoc comments.

## JSDoc Basics

All exported functions, classes, interfaces, and types should have JSDoc comments:

```typescript
/**
 * Brief description of what this does.
 *
 * Longer description if needed, explaining details,
 * usage patterns, or important notes.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @example
 * ```typescript
 * const result = myFunction('example')
 * ```
 */
export function myFunction(paramName: string): string {
  // ...
}
```

## Required Tags

### @param

Document all function parameters:

```typescript
/**
 * @param id - The unique identifier
 * @param options - Optional configuration object
 * @param options.flag - A boolean flag
 */
export function process(id: string, options?: { flag: boolean }) {
  // ...
}
```

### @returns

Document return values:

```typescript
/**
 * @returns A promise that resolves to the result
 */
export async function fetchData(): Promise<Data> {
  // ...
}
```

### @example

Include usage examples:

```typescript
/**
 * @example
 * ```typescript
 * const user = await getUserById('123')
 * console.log(user.name)
 * ```
 */
export async function getUserById(id: string): Promise<User> {
  // ...
}
```

## Optional Tags

### @since

Document when a feature was added:

```typescript
/**
 * @since 1.2.0
 */
export function newFeature() {
  // ...
}
```

### @deprecated

Mark deprecated APIs:

```typescript
/**
 * @deprecated Use newFunction() instead
 */
export function oldFunction() {
  // ...
}
```

### @see

Link to related documentation:

```typescript
/**
 * @see {@link RelatedFunction} for similar functionality
 */
export function myFunction() {
  // ...
}
```

## Validation

Run JSDoc validation:

```bash
pnpm docs:validate:jsdoc
```

Check coverage:

```bash
pnpm docs:coverage
```

## See Also

- [Contributing Documentation](./CONTRIBUTING-DOCS.md) - General contribution guide
- [Documentation Tools](../DOCUMENTATION-TOOLS.md) - Available tools
