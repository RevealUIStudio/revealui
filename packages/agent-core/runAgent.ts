import { routeModel } from '../../apps/model-router/index'
import { runRAG } from '../vector/index'

export async function runAgent(req: {
  id?: string
  mode?: string
  input?: string
  messages?: Array<{ role: string; content: string }>
}) {
  // req: { id, mode, input, messages }
  const context = await runRAG(req.input || '')

  const provider = await routeModel(req.input || '')

  const prompt = `${context}\n\n${req.input || ''}`.trim()

  const start = Date.now()
  const result = await (provider as any).generate({ prompt, messages: req.messages })
  const latency = Date.now() - start

  return {
    output: result.text,
    traces: [{ step: 'generation', provider: (provider as any).name, latencyMs: latency }],
  }
}
