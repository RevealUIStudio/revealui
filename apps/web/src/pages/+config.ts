import type { Config } from '@revealui/core/types'
// Import shared configuration from @revealui/config
import { getSharedWebConfig } from '@revealui/config/revealui'
import Layout from '../layouts/Default'

// Merge shared config with app-specific config
const config: Config = {
  ...getSharedWebConfig(),
  Layout,
  // App-specific overrides can be added here
}

export default config
