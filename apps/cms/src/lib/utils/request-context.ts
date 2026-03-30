/**
 * Extract request context (IP + user-agent) for session binding validation.
 *
 * Pass the result as the second argument to `getSession()` so the auth layer
 * can validate that the session matches the current request's origin.
 */
export function extractRequestContext(request: Request): {
  userAgent: string | undefined;
  ipAddress: string | undefined;
} {
  const headers = request.headers;
  return {
    userAgent: headers.get('user-agent') ?? undefined,
    ipAddress:
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headers.get('x-real-ip') ??
      undefined,
  };
}
