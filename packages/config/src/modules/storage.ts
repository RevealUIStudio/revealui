/**
 * @revealui/config - Storage Configuration Module
 */

import type { EnvConfig } from '../schema'

export interface StorageConfig {
  blobToken: string | undefined
}

export function getStorageConfig(env: EnvConfig): StorageConfig {
  return {
    blobToken: env.BLOB_READ_WRITE_TOKEN,
  }
}
