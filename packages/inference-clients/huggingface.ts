export default {
  name: 'huggingface',
  async generate({ prompt }: { prompt?: string }) {
    const token = process.env.HF_TOKEN
    if (!token) throw new Error('HF_TOKEN not set')
    // Prefer the HF router endpoint; allow overriding with HF_MODEL_URL
    const url =
      process.env.HF_MODEL_URL ||
      'https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3'
    const start = Date.now()
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt }),
    })

    const latencyMs = Date.now() - start

    // Handle non-JSON error bodies gracefully so debugging is easier
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`HuggingFace request failed: ${res.status} ${text}`)
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    let text: string
    if (contentType.includes('application/json')) {
      const json = await res.json()
      // HF sometimes returns [{ generated_text }]
      text =
        (json as any)?.generated_text ||
        (Array.isArray(json) ? (json as any)[0]?.generated_text : null) ||
        JSON.stringify(json)
    } else {
      // If not JSON, return raw text
      text = await res.text().catch(() => '')
    }

    return { text, latencyMs }
  },
}
