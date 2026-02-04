// This file is now clean - should pass all validators

import { logger } from '@revealui/core/logger'

export function processData(data: string) {
  logger.info('Processing data', { data }) // ✅ Using logger instead

  // TODO #123: Add data validation // ✅ Has issue reference

  return data.toUpperCase()
}
