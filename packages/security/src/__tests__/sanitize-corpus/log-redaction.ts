export interface LogKeyVector {
  key: string;
  rationale: string;
}

export interface LogValueVector {
  input: string;
  rationale: string;
}

/**
 * Keys whose values must always be redacted regardless of content.
 * Match is case-insensitive substring — `apiKey`, `API_KEY`, `x-api-key`,
 * `userApiKey` all resolve to the same sensitive class.
 */
export const SENSITIVE_KEY_VECTORS: readonly LogKeyVector[] = [
  { key: 'password', rationale: 'cleartext user password' },
  { key: 'Password', rationale: 'case-insensitive match' },
  { key: 'passwd', rationale: 'unix-style password field' },
  { key: 'pwd', rationale: 'short-form password field' },
  { key: 'secret', rationale: 'generic secret field' },
  { key: 'clientSecret', rationale: 'OAuth client secret' },
  { key: 'token', rationale: 'access / session token' },
  { key: 'accessToken', rationale: 'OAuth access token' },
  { key: 'refreshToken', rationale: 'OAuth refresh token' },
  { key: 'idToken', rationale: 'OIDC id token' },
  { key: 'csrfToken', rationale: 'CSRF defence token — still should not leak to logs' },
  { key: 'apiKey', rationale: 'API key camelCase' },
  { key: 'api_key', rationale: 'API key snake_case' },
  { key: 'x-api-key', rationale: 'API key header form' },
  { key: 'authorization', rationale: 'Authorization header' },
  { key: 'Authorization', rationale: 'Authorization header capitalised' },
  { key: 'cookie', rationale: 'raw Cookie header' },
  { key: 'setCookie', rationale: 'Set-Cookie header' },
  { key: 'session', rationale: 'session payload' },
  { key: 'sessionId', rationale: 'session identifier' },
  { key: 'privateKey', rationale: 'asymmetric private key' },
  { key: 'private_key', rationale: 'asymmetric private key snake_case' },
  {
    key: 'encryptedKey',
    rationale: 'stored-encrypted credential (still redact — avoids leaking ciphertext shape)',
  },
  { key: 'creditCard', rationale: 'credit card number' },
  { key: 'cardNumber', rationale: 'credit card number alt form' },
  { key: 'cvv', rationale: 'card verification value' },
  { key: 'cvc', rationale: 'card verification code' },
  { key: 'ssn', rationale: 'US social security number' },
];

/**
 * Keys that must NOT be redacted despite containing one of the sensitive
 * substrings — breaks observability if over-matched.
 */
export const SAFE_KEY_VECTORS: readonly LogKeyVector[] = [
  { key: 'userId', rationale: 'user id is routinely logged' },
  { key: 'requestId', rationale: 'request correlation id' },
  { key: 'traceId', rationale: 'distributed trace id' },
  { key: 'url', rationale: 'request url (sanitize query string separately)' },
  { key: 'method', rationale: 'HTTP method' },
  { key: 'status', rationale: 'HTTP status code' },
  { key: 'duration', rationale: 'timing field' },
  { key: 'message', rationale: 'log message' },
];

/**
 * Secret shapes that commonly leak in log *message* strings — not as a
 * dedicated field but concatenated into prose ("got response: sk_live_…").
 * Pattern-level redaction scrubs these substrings even when the key is
 * not in the sensitive list.
 */
export const SECRET_VALUE_VECTORS: readonly LogValueVector[] = [
  {
    input: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789',
    rationale: 'JWT with Bearer prefix',
  },
  {
    input: 'Authorization: Bearer abcdef0123456789abcdef0123456789',
    rationale: 'raw bearer token in header line',
  },
  {
    input: 'OpenAI key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
    rationale: 'OpenAI project key',
  },
  {
    input: 'charge via sk_live_51H7abcDEFghiJKLmnoPQRstuVWXyz0123',
    rationale: 'Stripe secret live key',
  },
  {
    input: 'webhook signed with whsec_abcdefghijklmnopqrstuvwxyz012345',
    rationale: 'Stripe webhook signing secret',
  },
  {
    input: 'iam user AKIAIOSFODNN7EXAMPLE has access',
    rationale: 'AWS access key id',
  },
  {
    input: 'pushing to ghp_abcdefghijklmnopqrstuvwxyz0123456789AB',
    rationale: 'GitHub classic personal access token',
  },
];
