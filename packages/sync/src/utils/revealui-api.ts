/**
 * RevealUI API Client Utilities
 *
 * Helper functions for calling RevealUI CMS API endpoints.
 * Uses verified RevealUI CMS API instead of unverified ElectricSQL mutation endpoints.
 */

/**
 * Get the RevealUI API base URL
 * Detects if we're in browser or server, uses appropriate environment variable
 */
export function getRevealUIApiUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser - use public URL or current origin
    return (
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_REVEALUI_PUBLIC_SERVER_URL ||
      window.location.origin
    )
  }
  // Server - use server URL
  return process.env.REVEALUI_PUBLIC_SERVER_URL || process.env.SERVER_URL || 'http://localhost:4000'
}

/**
 * Build headers for RevealUI API requests
 */
export function buildRevealUIHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return headers
}

/**
 * Call RevealUI CMS API endpoint
 */
export async function callRevealUIAPI<T = unknown>(
  endpoint: string,
  options: {
    method?: string
    body?: unknown
    authToken?: string
  } = {},
): Promise<T> {
  const { method = 'GET', body, authToken } = options
  const baseUrl = getRevealUIApiUrl()
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  const response = await fetch(url, {
    method,
    headers: buildRevealUIHeaders(authToken),
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `RevealUI API call failed (HTTP ${response.status}): ${errorText}\n` + `Endpoint: ${url}`,
    )
  }

  // Handle empty responses (e.g., DELETE)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await response.json()) as T
}

/**
 * Agent Context API endpoints
 * Uses existing /api/memory/context/:sessionId/:agentId routes
 */

export interface AgentContextUpdate {
  context: Record<string, unknown>
}

export async function updateAgentContext(
  sessionId: string,
  agentId: string,
  updates: Partial<AgentContextUpdate>,
  authToken?: string,
): Promise<void> {
  // Uses existing /api/memory/context/:sessionId/:agentId POST endpoint
  // This endpoint accepts { context: { ... } } or individual key-value pairs
  await callRevealUIAPI(
    `/api/memory/context/${encodeURIComponent(sessionId)}/${encodeURIComponent(agentId)}`,
    {
      method: 'POST',
      body: updates,
      authToken,
    },
  )
}

/**
 * Agent Memory API endpoints
 * Uses existing /api/memory/episodic/:userId routes
 * Note: This API uses userId, not agentId - may need adapter layer
 */

export async function createAgentMemory(
  userId: string,
  memory: unknown,
  authToken?: string,
): Promise<unknown> {
  // Uses existing /api/memory/episodic/:userId POST endpoint
  // Note: Route expects userId, not agentId
  return callRevealUIAPI(`/api/memory/episodic/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: memory,
    authToken,
  })
}

export async function updateAgentMemory(
  userId: string,
  memoryId: string,
  updates: unknown,
  authToken?: string,
): Promise<unknown> {
  // Note: Route expects userId and memoryId
  // This endpoint may not exist yet - will need to create it or use alternative
  return callRevealUIAPI(
    `/api/memory/episodic/${encodeURIComponent(userId)}/${encodeURIComponent(memoryId)}`,
    {
      method: 'PUT',
      body: updates,
      authToken,
    },
  )
}

export async function deleteAgentMemory(
  userId: string,
  memoryId: string,
  authToken?: string,
): Promise<void> {
  // Uses existing /api/memory/episodic/:userId/:memoryId DELETE endpoint
  await callRevealUIAPI(
    `/api/memory/episodic/${encodeURIComponent(userId)}/${encodeURIComponent(memoryId)}`,
    {
      method: 'DELETE',
      authToken,
    },
  )
}

/**
 * Conversation API endpoints
 * ✅ Uses RevealUI CMS auto-generated REST API endpoints
 * The Conversations collection is registered in CMS config and automatically
 * generates these endpoints:
 * - POST   /api/conversations - Create
 * - PATCH  /api/conversations/:id - Update
 * - DELETE /api/conversations/:id - Delete
 */

export async function createConversation(
  conversation: unknown,
  authToken?: string,
): Promise<unknown> {
  // ✅ Uses RevealUI CMS auto-generated endpoint
  return callRevealUIAPI('/api/conversations', {
    method: 'POST',
    body: conversation,
    authToken,
  })
}

export async function updateConversation(
  id: string,
  updates: unknown,
  authToken?: string,
): Promise<unknown> {
  // ✅ Uses RevealUI CMS auto-generated endpoint
  // Note: RevealUI CMS uses PATCH, not PUT
  return callRevealUIAPI(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: updates,
    authToken,
  })
}

export async function deleteConversation(id: string, authToken?: string): Promise<void> {
  // ✅ Uses RevealUI CMS auto-generated endpoint
  await callRevealUIAPI(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    authToken,
  })
}
