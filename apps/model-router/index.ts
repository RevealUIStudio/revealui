export async function routeModel(prompt: string) {
  // Simple routing logic — pick a provider module and return its exported object.
  // Returns an object with { name, generate({prompt, messages}) }
  if (!prompt || prompt.length < 600) {
    const mod = await import('../../packages/inference-clients/vultr')
    return (mod as any).default || mod
  }

  if (prompt.includes('```')) {
    const mod = await import('../../packages/inference-clients/docker')
    return (mod as any).default || mod
  }

  const mod = await import('../../packages/inference-clients/huggingface')
  return (mod as any).default || mod
}
