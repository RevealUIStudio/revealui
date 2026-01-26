export default {
  name: 'docker',
  async generate({ prompt }) {
    // Assumes text-generation-inference or similar serving at localhost:8080
    const url = process.env.DOCKER_MODEL_URL || 'http://localhost:8080/generate'
    const start = Date.now()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt }),
    })

    const latencyMs = Date.now() - start
    const json = await res.json()

    // TGI commonly returns { generated_text }
    const text = json?.generated_text || (Array.isArray(json) ? json[0]?.generated_text : null) || JSON.stringify(json)

    return { text, latencyMs }
  },
}
