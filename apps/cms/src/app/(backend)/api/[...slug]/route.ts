/* RevealUI REST API Routes - Local implementation */

import { createRESTHandlers } from '@revealui/core/api/rest';
import { logger } from '@revealui/utils/logger';
import type { NextRequest } from 'next/server';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';
import config from '../../../../../revealui.config';

// Force dynamic rendering to prevent build-time initialization
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

let handlers: Awaited<ReturnType<typeof createRESTHandlers>> | null = null;

async function getHandlers() {
  if (!handlers) {
    const revealui = await getRevealUIInstance();
    logger.info('[API Route] RevealUI initialized', {
      collections: Object.keys(revealui.collections || {}),
    });
    handlers = createRESTHandlers(config, revealui);
  }
  return handlers;
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers();
  return h.GET(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers();
  return h.POST(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers();
  return h.DELETE(req, context);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers();
  return h.PATCH(req, context);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const h = await getHandlers();
  return h.OPTIONS(req, context);
}
