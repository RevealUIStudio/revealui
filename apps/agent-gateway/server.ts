import http from 'http'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    try {
      let body = ''
      for await (const chunk of req as any) body += chunk
      const payload = JSON.parse(body || '{}')

      const messages = payload.messages || [{ role: 'user', content: payload.prompt || '' }]
      const prompt = messages.map((m: any) => m.content).join('\n')

      // Allow explicit provider override in request body to run a specific provider
      if (payload.provider) {
        try {
          const providerName = String(payload.provider)
          const providerModule = await import(join(__dirname, '..', '..', 'packages', 'inference-clients', `${providerName}`))
          const provider = (providerModule as any).default || providerModule
          const gen = await provider.generate({ prompt, messages })

          const out = { choices: [{ message: { role: 'assistant', content: gen.text } }] }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify(out))
          return
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Provider error: ${String(err)}` }))
          return
        }
      }

      // Dynamic import the runtime to keep startup fast.
      // Use correct relative path from apps/agent-gateway to packages/agent-core
      const runtimeMod = await import(join(__dirname, '..', '..', 'packages', 'agent-core', 'runAgent'))
      const runAgent = (runtimeMod as any).runAgent

      const result = await runAgent({ id: (globalThis as any).crypto?.randomUUID?.() || Date.now().toString(), mode: 'execute', input: prompt, messages })

      const out = {
        choices: [
          { message: { role: 'assistant', content: result.output } }
        ]
      }

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify(out))
      return
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
      return
    }
  }

  res.writeHead(404)
  res.end('Not found')
}

const server = http.createServer(handle)
const port = process.env.PORT || '3000'
server.listen(Number(port), () => console.log(`Agent Gateway listening on :${port}`))
