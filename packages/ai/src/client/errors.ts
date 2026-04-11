/**
 * Client-safe AI error classes.
 *
 * Lightweight errors for React hooks — no server-side dependencies.
 * Consumers can programmatically handle specific error types (retry on 429, redirect on 401).
 */

export class AIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly operation: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export function createAIError(operation: string, statusCode: number, statusText: string): AIError {
  const message =
    statusCode === 401
      ? `Authentication required for ${operation}`
      : statusCode === 403
        ? `Insufficient permissions for ${operation}`
        : statusCode === 404
          ? `Resource not found: ${operation}`
          : statusCode === 429
            ? `Too many requests — retry ${operation} shortly`
            : `${operation} failed: ${statusText}`;

  return new AIError(message, statusCode, operation);
}
