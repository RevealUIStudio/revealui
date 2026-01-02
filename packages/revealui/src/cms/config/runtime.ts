import type { Config, Payload } from '../types/index'

let payloadInstance: Payload | null = null
let configInstance: Config | null = null

export async function getPayload(options: { config: Config }): Promise<Payload> {
  if (payloadInstance && configInstance === options.config) {
    return payloadInstance
  }

  // Import the payload implementation
  const { createRevealUIPayload } = await import('../core/revealui')

  payloadInstance = await createRevealUIPayload(options.config)
  configInstance = options.config

  return payloadInstance
}

export async function getRevealUI(options: { config: Config }): Promise<Payload> {
  // In development, always create a new instance to support HMR
  if (process.env.NODE_ENV === 'development') {
    payloadInstance = null
    configInstance = null
  }

  return getPayload(options)
}
