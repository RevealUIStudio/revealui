#!/usr/bin/env node
// Demo script to exercise Vultr Inference (chat + embeddings)
// Usage:
// Use ts-node or compile to JS. Example with ts-node:
// VULTR_API_KEY=your_key VULTR_MODEL=your-model-id ts-node packages/ai/scripts/test-vultr.ts

const KEY = process.env.VULTR_API_KEY
const MODEL = process.env.VULTR_MODEL
const BASE = process.env.VULTR_BASE_URL || 'https://api.vultrinference.com/v1'

if (!KEY || !MODEL) {
  console.error('Missing VULTR_API_KEY or VULTR_MODEL environment variables')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${KEY}`,
}

async function chat(prompt: string) {
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 256,
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Chat request failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  console.log('Chat response:')
  console.dir(data, { depth: 3 })
  const choice = Array.isArray((data).choices) ? (data).choices[0] : undefined
  const message =
    choice && (choice).message
      ? (choice).message
      : choice && (choice).text
        ? { content: (choice).text }
        : undefined
  if (message) {
    console.log('\nAssistant output:')
    console.log(typeof message.content === 'string' ? message.content : JSON.stringify(message))
  }
}

async function embed(inputs: string | string[]) {
  const body = {
    model: MODEL,
    input: Array.isArray(inputs) ? inputs : [inputs],
  }

  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Embeddings request failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  console.log('\nEmbeddings response:')
  console.dir(data, { depth: 3 })
}

async function main() {
  try {
    await chat('What is the capital of France?')
    await embed('This is a test embedding.')
  } catch (err) {
    console.error('Error during demo:', err instanceof Error ? err.message : String(err))
    process.exitCode = 2
  }
}

await main()

// ensure this file is treated as a module to avoid global name collisions during repo-wide TS checks
export {}
