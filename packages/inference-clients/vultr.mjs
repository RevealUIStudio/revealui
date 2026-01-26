const DEFAULT_MODEL = process.env.VULTR_MODEL || 'meta-llama/Llama-3-8b-instruct'

export default {
  name: 'vultr',
  async generate({ prompt, messages }) {
    const apiKey = process.env.VULTR_API_KEY
    const base = process.env.VULTR_BASE_URL || 'https://api.vultrinference.com/v1'
    if (!apiKey) throw new Error('VULTR_API_KEY not set')

    const body = messages
      ? { model: process.env.VULTR_MODEL || DEFAULT_MODEL, messages }
      : { model: process.env.VULTR_MODEL || DEFAULT_MODEL, messages: [{ role: 'user', content: prompt }] }

    const start = Date.now()
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const latencyMs = Date.now() - start
    const json = await res.json()

    // Try to extract assistant text from common shapes
    const text = json?.choices?.[0]?.message?.content || json?.output || JSON.stringify(json)

    return { text, latencyMs }
  },
  /**
   * stream: call the Vultr chat completions streaming endpoint and invoke onDelta for partial data
   * onDelta is called with objects like: { delta: 'text fragment' } and finally { done: true }
   */
  async stream({ prompt, messages, onDelta }) {
    const apiKey = process.env.VULTR_API_KEY
    const base = process.env.VULTR_BASE_URL || 'https://api.vultrinference.com/v1'
    if (!apiKey) throw new Error('VULTR_API_KEY not set')

    const body = messages
      ? { model: process.env.VULTR_MODEL || DEFAULT_MODEL, messages, stream: true }
      : { model: process.env.VULTR_MODEL || DEFAULT_MODEL, messages: [{ role: 'user', content: prompt }], stream: true }

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Vultr stream request failed: ${res.status} ${text}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // process lines
      let nlIndex
      while ((nlIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nlIndex).trim()
        buffer = buffer.slice(nlIndex + 1)
        if (!line) continue
        // Vultr streaming uses SSE-style lines starting with "data:"
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          if (typeof onDelta === 'function') onDelta({ done: true })
          return
        }
        try {
          const obj = JSON.parse(payload)
          const delta = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.message?.content
          if (delta && typeof onDelta === 'function') onDelta({ delta })
        } catch (err) {
          // ignore JSON parse errors for partial data
        }
      }
    }

    // finished reading; if any trailing buffer, try to parse
    if (buffer) {
      const remaining = buffer.trim()
      if (remaining && remaining !== 'data: [DONE]') {
        try {
          const obj = JSON.parse(remaining.replace(/^data:\s*/, ''))
          const delta = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.message?.content
          if (delta && typeof onDelta === 'function') onDelta({ delta })
        } catch (err) {}
      }
    }

    if (typeof onDelta === 'function') onDelta({ done: true })
  },
}
