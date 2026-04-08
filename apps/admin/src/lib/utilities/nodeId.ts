/**
 * Node ID Helper
 *
 * Gets or creates a persistent node ID for CRDT operations.
 * Node IDs should be consistent across requests for the same user/session
 * to maintain proper CRDT semantics.
 */

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

const NODE_ID_COOKIE_NAME = 'revealui-node-id';
const NODE_ID_HEADER_NAME = 'x-revealui-node-id';

/**
 * Gets the node ID from the request.
 *
 * Priority:
 * 1. Header (x-revealui-node-id) - for API clients
 * 2. Cookie (revealui-node-id) - for browser clients
 * 3. Generate new and set cookie - first request
 *
 * @param request - Next.js request object (optional, for header access)
 * @returns Node ID string
 */
export async function getNodeId(request?: Request): Promise<string> {
  // Try to get from header first (for API clients)
  if (request) {
    const headerNodeId = request.headers.get(NODE_ID_HEADER_NAME);
    if (headerNodeId) {
      return headerNodeId;
    }
  }

  // Try to get from cookie (for browser clients)
  const cookieStore = await cookies();
  const cookieNodeId = cookieStore.get(NODE_ID_COOKIE_NAME)?.value;

  if (cookieNodeId) {
    return cookieNodeId;
  }

  // Generate new node ID and set cookie
  const newNodeId = randomUUID();
  cookieStore.set(NODE_ID_COOKIE_NAME, newNodeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });

  return newNodeId;
}

/**
 * Gets node ID from session ID (for server-side usage).
 * Uses NodeIdService for deterministic, collision-resistant node IDs.
 *
 * @param sessionId - Session identifier
 * @param db - Database client (optional, will use getClient() if not provided)
 * @returns Node ID string (UUID)
 * @throws Error if sessionId is invalid or database operation fails
 */
type Database = Awaited<ReturnType<typeof import('@revealui/db/client').getClient>>;

type NodeIdServiceConstructor = new (
  db: Database,
) => {
  getNodeId(scope: 'session' | 'user', entityId: string): Promise<string>;
};

type NodeIdServiceModule = {
  NodeIdService: NodeIdServiceConstructor;
};

async function loadNodeIdServiceModule(): Promise<NodeIdServiceModule> {
  const nodeIdModule = await import('@revealui/ai/memory/services').catch(() => null);
  if (!nodeIdModule) {
    throw new Error('AI memory features require @revealui/ai (Pro)');
  }

  return nodeIdModule as NodeIdServiceModule;
}

export async function getNodeIdFromSession(sessionId: string, db?: Database): Promise<string> {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('Invalid sessionId: must be a non-empty string');
  }

  const { getClient } = await import('@revealui/db/client');
  const nodeIdModule = await loadNodeIdServiceModule();

  const database = db || getClient();
  const service = new nodeIdModule.NodeIdService(database);

  return service.getNodeId('session', sessionId);
}

/**
 * Gets node ID from user ID (for user-scoped operations).
 * Uses NodeIdService for deterministic, collision-resistant node IDs.
 *
 * @param userId - User identifier
 * @param db - Database client (optional, will use getClient() if not provided)
 * @returns Node ID string (UUID)
 * @throws Error if userId is invalid or database operation fails
 */
export async function getNodeIdFromUser(userId: string, db?: Database): Promise<string> {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  const { getClient } = await import('@revealui/db/client');
  const nodeIdModule = await loadNodeIdServiceModule();

  const database = db || getClient();
  const service = new nodeIdModule.NodeIdService(database);

  return service.getNodeId('user', userId);
}
