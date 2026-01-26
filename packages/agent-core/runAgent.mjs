import { routeModel } from '../../apps/model-router/index.mjs'
import { runRAG } from '../vector/index.mjs'

export async function runAgent(req) {
  // req: { id, mode, input, messages }
  const context = await runRAG(req.input || '')

  const provider = await routeModel(req.input || '')

  const prompt = `${context}\n\n${req.input || ''}`.trim()

  const start = Date.now()
  const result = await provider.generate({ prompt, messages: req.messages })
  const latency = Date.now() - start

  return {
    output: result.text,
    traces: [{ step: 'generation', provider: provider.name, latencyMs: latency }],
  }
}
