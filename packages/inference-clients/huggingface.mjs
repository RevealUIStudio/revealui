export default {
  name: 'huggingface',
  async generate({ prompt }) {
    const token = process.env.HF_TOKEN
    if (!token) throw new Error('HF_TOKEN not set')

    const url = process.env.HF_MODEL_URL || 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2'
    const start = Date.now()
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt }),
    })

    const latencyMs = Date.now() - start
    const json = await res.json()

    // HF sometimes returns [{ generated_text }]
    const text = json?.generated_text || (Array.isArray(json) ? json[0]?.generated_text : null) || JSON.stringify(json)

    return { text, latencyMs }
  },
}
