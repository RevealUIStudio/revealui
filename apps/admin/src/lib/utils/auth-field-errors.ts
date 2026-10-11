/**
 * First schema issue for a field. Login and signup render these strings
 * instead of the browser's native validation tooltip.
 */

export interface FieldIssue {
  path: ReadonlyArray<PropertyKey>;
  message: string;
}

export function messageForPath(issues: readonly FieldIssue[], field: string): string | undefined {
  for (const issue of issues) {
    if (issue.path[0] === field) return issue.message;
  }
  return undefined;
}
