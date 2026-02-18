import { AgentCollabClient, type AgentIdentity } from './agent-client.js'

const DEFAULT_AGENT_COLOR = '#8B5CF6'

export interface CreateAgentClientOptions {
  serverUrl: string
  documentId: string
  name?: string
  model?: string
  color?: string
  authToken?: string
  autoReconnect?: boolean
  defaultTextName?: string
}

export function createAgentClient(options: CreateAgentClientOptions): AgentCollabClient {
  const identity: AgentIdentity = {
    type: 'agent',
    name: options.name ?? 'AI Agent',
    model: options.model ?? 'unknown',
    color: options.color ?? DEFAULT_AGENT_COLOR,
  }

  return new AgentCollabClient({
    serverUrl: options.serverUrl,
    documentId: options.documentId,
    identity,
    authToken: options.authToken,
    autoReconnect: options.autoReconnect,
    defaultTextName: options.defaultTextName,
  })
}

export async function createAndConnectAgentClient(
  options: CreateAgentClientOptions & { syncTimeoutMs?: number },
): Promise<AgentCollabClient> {
  const client = createAgentClient(options)
  client.connect()
  await client.waitForSync(options.syncTimeoutMs ?? 5000)
  return client
}
