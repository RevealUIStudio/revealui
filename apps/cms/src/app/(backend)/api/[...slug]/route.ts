/* RevealUI REST API Routes - Local implementation */
import configPromise from "@reveal-config";
import { createRESTHandlers } from "@revealui/cms/api/rest";
import { getRevealUI } from "@revealui/cms";
import type { NextRequest } from "next/server";

// Force dynamic rendering to prevent build-time initialization
export const dynamic = "force-dynamic";
export const dynamicParams = true;

let revealInstance: any = null;
let handlers: Awaited<ReturnType<typeof createRESTHandlers>> | null = null;

async function getReveal() {
  if (!revealInstance) {
    revealInstance = await getRevealUI({ config: configPromise });
  }
  return revealInstance;
}

async function getHandlers() {
  if (!handlers) {
    const config = await configPromise;
    const revealui = await getReveal();
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
