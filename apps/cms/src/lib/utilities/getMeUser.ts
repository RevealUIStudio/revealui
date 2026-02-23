import type { RevealUser } from '@revealui/core'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  token: string
  user: RevealUser
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = await cookies()
  const token = cookieStore.get('revealui-session')?.value

  // Early validation: Check token before making API call
  // This helps identify the root cause of missing tokens
  if (!token) {
    // Check if redirects are configured (they should handle this case)
    if (nullUserRedirect) {
      // Redirect is configured, so missing token is expected for unauthenticated users
      redirect(nullUserRedirect)
    }

    // No redirect configured but token is missing - this indicates a configuration issue
    // Possible root causes:
    // 1. Cookie not set after login (check login route)
    // 2. Cookie expired (check cookie expiration settings)
    // 3. Cookie domain/path mismatch (check cookie settings)
    // 4. Middleware not running (check middleware configuration)
    throw new Error(
      'Authentication token is missing. ' +
        'Possible causes: cookie not set after login, cookie expired, cookie domain/path mismatch, or middleware not running. ' +
        'Check: 1) login route sets cookie correctly, 2) cookie expiration settings, 3) cookie domain/path, 4) middleware configuration.',
    )
  }

  const meUserReq = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth/me`, {
    headers: {
      // biome-ignore lint/style/useNamingConvention: standard HTTP header name
      Cookie: `revealui-session=${token}`,
    },
  })

  const response = (await meUserReq.json()) as { user: RevealUser }
  const { user } = response

  if (validUserRedirect && meUserReq.ok && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && !(meUserReq.ok && user)) {
    redirect(nullUserRedirect)
  }

  return {
    token,
    user,
  }
}
