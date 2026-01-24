// Import shared configuration from @revealui/config
import { getSharedWebConfig } from '@revealui/config/revealui'
import type { Config } from '@revealui/core/types'
import Layout from '../layouts/Default'

// Merge shared config with app-specific config
const getSharedWebConfigTyped = getSharedWebConfig as () => Partial<Config>

const config: Config = {
  ...getSharedWebConfigTyped(),
  // biome-ignore lint/style/useNamingConvention: Vike config uses a PascalCase Layout key.
  Layout,
  // App-specific overrides can be added here
}

export default config
