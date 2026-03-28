/**
 * Studio Auth API Client
 *
 * Communicates with the RevealUI API's /api/studio-auth endpoints
 * for device-based OTP authentication.
 */

// ── Response types ──────────────────────────────────────────────────────────

export interface LinkResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  error?: string;
}

export interface RefreshResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
}

export interface StatusResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  device?: {
    id: string;
    name: string;
  };
  tokenExpiresAt?: string | null;
}

// ── Client ──────────────────────────────────────────────────────────────────

function getDeviceId(): string {
  const key = 'revealui-studio-device-id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

function getDeviceName(): string {
  const platform = navigator.platform || 'Unknown';
  return `RevealUI Studio (${platform})`;
}

async function request<T>(apiUrl: string, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api/studio-auth${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  return (await res.json()) as T;
}

/**
 * Request an OTP code to be sent to the given email.
 */
export async function linkDevice(apiUrl: string, email: string): Promise<LinkResponse> {
  return request<LinkResponse>(apiUrl, '/link', {
    method: 'POST',
    body: JSON.stringify({
      email,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      deviceType: 'desktop',
    }),
  });
}

/**
 * Verify the OTP code and receive a bearer token.
 */
export async function verifyDevice(
  apiUrl: string,
  email: string,
  code: string,
): Promise<VerifyResponse> {
  return request<VerifyResponse>(apiUrl, '/verify', {
    method: 'POST',
    body: JSON.stringify({
      email,
      deviceId: getDeviceId(),
      code,
    }),
  });
}

/**
 * Rotate the bearer token. Returns a new token.
 */
export async function refreshToken(apiUrl: string, token: string): Promise<RefreshResponse> {
  return request<RefreshResponse>(apiUrl, '/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Revoke the bearer token (sign out).
 */
export async function revokeToken(apiUrl: string, token: string): Promise<void> {
  await request(apiUrl, '/revoke', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Check auth status and get user info.
 */
export async function checkStatus(apiUrl: string, token: string): Promise<StatusResponse> {
  return request<StatusResponse>(apiUrl, '/status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}
