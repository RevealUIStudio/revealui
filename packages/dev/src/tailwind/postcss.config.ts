import type { Config } from 'postcss-load-config'

const config: Config = {
  plugins: {
    'postcss-import': {
      path: ['src'],
    },
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}

export default config
