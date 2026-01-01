/* RevealUI REST API Routes - Local implementation */
import configPromise from "@reveal-config";
import { createRESTHandlers } from "@revealui/cms/api/rest";
import { getRevealUI } from "@revealui/cms";

// Force dynamic rendering to prevent build-time initialization
export const dynamic = "force-dynamic";
export const dynamicParams = true;

let payloadInstance: any = null;

async function getPayload() {
  if (!payloadInstance) {
    payloadInstance = await getRevealUI({ config: configPromise });
  }
  return payloadInstance;
}

const handlers = createRESTHandlers(await configPromise, await getPayload());

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;
export const OPTIONS = handlers.OPTIONS;
