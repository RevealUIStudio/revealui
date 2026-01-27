#!/usr/bin/env node
// Example demonstrating a simple API call to Vultr inference for an llm.
// Reads VULTR_* vars from your .env when you `set -a; . ./.env; set +a` in bash.

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

async function main() {
  const prompt = 'Explain reinforcement learning in two sentences.'
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 256,
  }

  try {
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
    console.log('Response:')
    console.dir(data, { depth: 3 })
    const choice = Array.isArray(data.choices) ? data.choices[0] : undefined
    const message =
      choice && choice.message
        ? choice.message
        : choice && choice.text
          ? { content: choice.text }
          : undefined
    if (message) {
      console.log('\nAssistant output:')
      console.log(typeof message.content === 'string' ? message.content : JSON.stringify(message))
    }
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exitCode = 2
  }
}

main()

// ensure this file is treated as a module to avoid global name collisions during repo-wide TS checks
export {}
