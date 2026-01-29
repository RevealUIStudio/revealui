export async function routeModel(prompt: string) {
  // Simple routing logic — pick a provider module and return its exported object.
  // Returns an object with { name, generate({prompt, messages}) }
  if (!prompt || prompt.length < 600) {
    const mod = await import('./vultr.js')
    return (mod as { default?: unknown }).default || mod
  }

  if (prompt.includes('```')) {
    const mod = await import('./docker.js')
    return (mod as { default?: unknown }).default || mod
  }

  const mod = await import('./huggingface.js')
  return (mod as { default?: unknown }).default || mod
}
