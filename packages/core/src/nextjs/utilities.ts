import { getRevealUI as getRevealUICore } from '../config/runtime.js'
import type { Config, RevealUIInstance } from '../types/index.js'

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

  revealInstance = await getRevealUICore({ config: options.config as unknown as Record<string, unknown> })
  configInstance = options.config

  return revealInstance
}
