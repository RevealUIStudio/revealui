import config from '@revealui/config/revealui'
import { getRevealUI } from '@revealui/core'
import jwt from 'jsonwebtoken'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

// Force dynamic rendering to prevent build-time RevealUI CMS initialization
export const dynamic = 'force-dynamic'

const authToken = 'revealui-token'

export async function GET(req: NextRequest): Promise<Response> {
  const revealui = await getRevealUI({ config })
  const token = req.cookies.get(authToken)?.value
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')

  if (!path) {
    return new Response('No path provided', { status: 404 })
  }

  if (!token) {
    return new Response('You are not allowed to preview this page', {
      status: 403,
    })
  }

  let user: jwt.JwtPayload | string | null = null

  const secret = revealui.secret || process.env.REVEALUI_SECRET || ''
  if (!secret) {
    return new Response('Server configuration error: no secret configured', {
      status: 500,
    })
  }

  try {
    user = jwt.verify(token, secret) as jwt.JwtPayload | string
  } catch (error) {
    revealui.logger.error(
      `Error verifying token for live preview: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // You can add additional checks here to see if the user is allowed to preview this page
  if (!user) {
    const draft = await draftMode()
    draft.disable()
    return new Response('You are not allowed to preview this page', {
      status: 403,
    })
  }

  const draft = await draftMode()
  draft.enable()
  redirect(path)
}
