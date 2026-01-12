/**
 * Authentication utilities for admin dashboard
 * Handles JWT token retrieval and management
 */

/**
 * Get JWT token from cookies or localStorage
 * Priority: cookies > localStorage
 */
export function getAuthToken(): string | null {
  // Try to get from cookies first (server-side compatible)
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    const tokenCookie = cookies.find((cookie) => {
      // Defensive check: cookie might be undefined or empty
      if (!cookie || typeof cookie !== 'string') {
        return false
      }
      return cookie.trim().startsWith('revealui-token=')
    })
    if (tokenCookie) {
      return tokenCookie.split('=')[1]?.trim() || null
    }

    // Fallback to localStorage
    return localStorage.getItem('revealui-token')
  }

  return null
}

/**
 * Set JWT token in localStorage
 * Note: Cookies are set server-side, this is for client-side fallback
 */
export function setAuthToken(token: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('revealui-token', token)
  }
}

/**
 * Remove JWT token from storage
 */
export function clearAuthToken(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('revealui-token')
  }
  // Note: Cookie clearing should be done server-side
}

/**
 * Get Authorization header value
 */
export function getAuthHeader(): string | null {
  const token = getAuthToken()
  return token ? `JWT ${token}` : null
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}
