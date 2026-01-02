import type { Config, RevealUIInstance } from '../types/index'

let revealInstance: RevealUIInstance | null = null
let configInstance: Config | null = null

export async function getRevealUI(options: { config: Config }): Promise<RevealUIInstance> {
  // In development, always create a new instance to support HMR
  if (process.env.NODE_ENV === 'development') {
    revealInstance = null
    configInstance = null
  }

  if (revealInstance && configInstance === options.config) {
    return revealInstance
  }

  // Import the RevealUI implementation
  const { createRevealUIInstance } = await import('../core/revealui')

  revealInstance = await createRevealUIInstance(options.config)
  configInstance = options.config

  return revealInstance
}
