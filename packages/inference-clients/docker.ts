type DockerResult = { text: string; latencyMs: number }

function joinUrl(base: string, path?: string) {
  if (!base) return null
  const b = base.replace(/\/+$/, '')
  if (!path) return b
  return `${b}${path.startsWith('/') ? path : `/${path}`}`
}

export default {
  name: 'docker',
  async generate({ prompt }: { prompt?: string }): Promise<DockerResult> {
    // Configuration options:
    // - DOCKER_MODEL_URL (full URL, highest priority)
    // - DOCKER_MODEL_BASE + DOCKER_MODEL_PATH (base + path)
    // - fallback: http://localhost:8080/generate
    // Prefer an explicit inference endpoint env var, then fall back to older names
    const fullUrl = process.env.DOCKER_INFERENCE_URL
      || process.env.DOCKER_MODEL_URL
      || joinUrl(process.env.DOCKER_MODEL_BASE || 'http://localhost:8080', process.env.DOCKER_MODEL_PATH || '/generate')

    const start = Date.now()
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt }),
    })

    const latencyMs = Date.now() - start
    const json = await res.json()

    // TGI commonly returns { generated_text }
    const text = (json as any)?.generated_text || (Array.isArray(json) ? (json as any)[0]?.generated_text : null) || JSON.stringify(json)

    return { text, latencyMs }
  },
}
