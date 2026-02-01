/* RevealUI REST API Routes - Local implementation */

import { getRevealUI } from '@revealui/core'
import { createRESTHandlers } from '@revealui/core/api/rest'
import type { NextRequest } from 'next/server'
import config from '@revealui/config/revealui'

// Force dynamic rendering to prevent build-time initialization
export const dynamic = 'force-dynamic'
export const dynamicParams = true

let revealInstance: Awaited<ReturnType<typeof getRevealUI>> | null = null
let handlers: Awaited<ReturnType<typeof createRESTHandlers>> | null = null

async function getReveal() {
  if (!revealInstance) {
    revealInstance = await getRevealUI({ config })
  }
  return revealInstance
}

async function getHandlers() {
  if (!handlers) {
    const revealui = await getReveal()
    handlers = createRESTHandlers(config, revealui)
  }
  return handlers
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers()
  return h.GET(req, context)
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers()
  return h.POST(req, context)
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers()
  return h.DELETE(req, context)
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers()
  return h.PATCH(req, context)
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers()
  return h.OPTIONS(req, context)
}
