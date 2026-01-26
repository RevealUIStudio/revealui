export default {
  name: 'mock',
  async generate({ prompt, messages }: { prompt?: string; messages?: any[] }) {
    const reply = `Mock reply: received ${messages?.length ?? 0} messages; prompt length ${String(prompt).length}`
    return { text: reply, latencyMs: 0 }
  },
}
