import Layout from "../layouts/Default"
import type { Config } from "@revealui/types"

const config = {
  Layout,
  prerender: {
    partial: false,
    noExtraDir: false,
    parallel: 4,
    disableAutoRun: false
  }
} satisfies Config

export default config
