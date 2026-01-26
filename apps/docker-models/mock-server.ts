import http from 'http'
import { parse } from 'url'

const port = 8000

const server = http.createServer(async (req, res) => {
  const url = parse(req.url || '', true)
  // Accept both the original chat completions path and a TGI /generate path
  if (req.method === 'POST' && (url.pathname === '/v1/chat/completions' || url.pathname === '/generate')) {
    let body = ''
    for await (const chunk of req) body += chunk
    // Return a simple TGI-like response
    const out = { generated_text: 'Mock Docker model response: Hello from TGI mock' }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(out))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(port, () => console.log(`Mock Docker model server listening on :${port}`))

process.on('SIGINT', () => server.close(() => process.exit(0)))
