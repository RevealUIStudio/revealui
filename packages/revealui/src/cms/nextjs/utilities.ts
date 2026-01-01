import { getPayload } from '../config/runtime';
import type { Config, Payload } from '../types/index';

let payloadInstance: Payload | null = null;
let configInstance: Config | null = null;

export async function getRevealUI(options: { config: Config }): Promise<Payload> {
  // In development, always create a new instance to support HMR
  if (process.env.NODE_ENV === 'development') {
    payloadInstance = null;
    configInstance = null;
  }

  if (payloadInstance && configInstance === options.config) {
    return payloadInstance;
  }

  payloadInstance = await getPayload(options);
  configInstance = options.config;

  return payloadInstance;
}

