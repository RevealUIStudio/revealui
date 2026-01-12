import aspectRatio from '@tailwindcss/aspect-ratio'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const fontFamily = defaultTheme?.fontFamily || {}

const config: Config = {
  darkMode: 'class',
  theme: {
    screens: {
      ...defaultTheme.screens,
    },
    container: {
      center: true,
    },
    aspectRatio: {
      ...defaultTheme.aspectRatio,
    },
    fontFamily: {
      sans: ['Inter', ...(fontFamily.sans || [])],
      serif: ['Merriweather', ...(fontFamily.serif || [])],
    },
    extend: {
      screens: {
        xs: '475px',
        '3xl': '1920px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      maxWidth: {
        '8xl': '1920px',
      },
      aspectRatio: {
        '3/2': '3 / 2',
        '4/3': '4 / 3',
        '21/9': '21 / 9',
        '16/9': '16 / 9',
        '1/1': '1 / 1',
      },
    },
  },
  plugins: [typography, forms, aspectRatio],
}

export default config
