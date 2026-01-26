#!/usr/bin/env node
import { spawn, spawnSync } from 'child_process'

function killProcessOnPort(port = 3000) {
  try {
    const ls = spawnSync('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-t'])
    const out = ls.stdout?.toString().trim() || ''
    if (out) {
      const pids = out.split(/\s+/)
      for (const p of pids) {
        try { process.kill(Number(p)) } catch (e) {}
      }
      return
    }
  } catch (e) {}

  try {
    const ss = spawnSync('ss', ['-ltnp'])
    const s = ss.stdout?.toString() || ''
    const re = new RegExp(`:3000\\s.*pid=(\\d+),`)
    const m = s.match(re)
    if (m && m[1]) {
      try { process.kill(Number(m[1])) } catch (e) {}
    }
  } catch (e) {}
}

killProcessOnPort(3000)

const serverProcess = spawn(process.execPath, ['apps/agent-gateway/server.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
serverProcess.stdout.setEncoding('utf8')
serverProcess.stdout.on('data', (d) => {
  stdout += d
  process.stdout.write(d)
})
serverProcess.stderr.setEncoding('utf8')
serverProcess.stderr.on('data', (d) => {
  stderr += d
  process.stderr.write(d)
})

function waitForServerStarted(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const iv = setInterval(() => {
      if (stdout.includes('Agent Gateway listening')) {
        clearInterval(iv)
        resolve(undefined)
      }
      if (Date.now() - start > timeout) {
        clearInterval(iv)
        reject(new Error('server did not start within timeout:\n' + stdout + '\n' + stderr))
      }
    }, 50)
  })
}

async function runTest() {
  try {
    await waitForServerStarted(5000)

    const res = await fetch('http://localhost:3000/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'mock', messages: [{ role: 'user', content: 'testing mock' }] }),
    })

    const json = await res.json()
    if (!json || !Array.isArray(json.choices) || !json.choices[0]?.message?.content) {
      throw new Error('unexpected response: ' + JSON.stringify(json))
    }

    const content = json.choices[0].message.content
    if (!content.startsWith('Mock reply')) {
      throw new Error('unexpected mock response content: ' + content)
    }

    console.log('Integration test passed')
    process.exit(0)
  } catch (err) {
    console.error('Integration test failed:', err)
    process.exit(2)
  } finally {
    try {
      serverProcess.kill()
    } catch (e) {}
  }
}

runTest()
