export async function routeModel(prompt) {
  // Simple routing logic — pick a provider module and return its exported object.
  // Returns an object with { name, generate({prompt, messages}) }
  if (!prompt || prompt.length < 600) {
    return (await import('../../packages/inference-clients/vultr.mjs')).default
  }

  if (prompt.includes('```')) {
    return (await import('../../packages/inference-clients/docker.mjs')).default
  }

  return (await import('../../packages/inference-clients/huggingface.mjs')).default
}
