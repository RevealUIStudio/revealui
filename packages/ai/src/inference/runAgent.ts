import { routeModel } from './routeModel.js'
import { runRAG } from './runRag.js'

interface Provider {
  name: string
  generate: (args: {
    prompt: string
    messages?: Array<{ role: string; content: string }>
  }) => Promise<{ text: string }>
}

export async function runAgent(req: {
  id?: string
  mode?: string
  input?: string
  messages?: Array<{ role: string; content: string }>
}) {
  // req: { id, mode, input, messages }
  const context = await runRAG(req.input || '')

  const provider = (await routeModel(req.input || '')) as Provider

  const prompt = `${context}\n\n${req.input || ''}`.trim()

  const start = Date.now()
  const result = await provider.generate({ prompt, messages: req.messages })
  const latency = Date.now() - start

  return {
    output: result.text,
    traces: [{ step: 'generation', provider: provider.name, latencyMs: latency }],
  }
}
