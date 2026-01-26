export type AgentMode = 'plan' | 'debug' | 'execute'

export interface AgentRequest {
  id: string
  mode: AgentMode
  input: string
  context?: string[]
  capabilities?: string[]
  messages?: Array<{ role: string; content: string }>
}

export interface AgentResponse {
  output: string
  traces?: AgentTrace[]
}

export interface AgentTrace {
  step: string
  provider: string
  latencyMs: number
}
