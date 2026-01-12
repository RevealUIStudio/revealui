import type { Config } from '@revealui/types'
// Import shared configuration from root revealui.config.ts
import { getSharedWebConfig } from '../../../revealui.config'
import Layout from '../layouts/Default'

// Merge shared config with app-specific config
const config: Config = {
  ...getSharedWebConfig(),
  Layout,
  // App-specific overrides can be added here
}

export default config
