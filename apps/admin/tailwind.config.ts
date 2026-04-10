/**
 * Tailwind CSS Configuration for admin App
 *
 * Uses shared config from dev package and extends with app-specific settings
 */
import { createTailwindConfig } from '@revealui/dev/tailwind/create-config';

// function generateSafelist(): string[] {
//   const colors = ['scrapOrange', 'scrapBlack', 'scrapYellow', 'scrapWhite']
//   const prefixes = ['from', 'to', 'ring', 'shadow']

//   const safelist: string[] = []
//   colors.forEach((color) => {
//     prefixes.forEach((prefix) => {
//       safelist.push(`${prefix}-${color}`)
//       if (prefix === 'shadow') {
//         safelist.push(`${prefix}-${color}/20`)
//       }
//     })
//   })

//   return safelist
// }

export default createTailwindConfig({
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    '../../packages/core/src/admin/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      screens: {
        '8xl': '1920px',
        '9xl': '2560px',
        '10xl': '3840px',
      },
      colors: {
        scrapBlack: '#020617',
        scrapWhite: '#f8fafc',
        scrapRed: '#b91c1c',
        scrapYellow: '#fde047',
        scrapOrange: '#ea580c',
        scrapGreen: '#15803d',
        scrapBlue: '#1e3a8a',
      },
      maxWidth: {
        '9xl': '2560px',
        '10xl': '3840px',
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.5rem' }],
        base: ['1rem', { lineHeight: '1.75rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '2rem' }],
        '2xl': ['1.5rem', { lineHeight: '2.25rem' }],
        '3xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '4xl': ['2rem', { lineHeight: '2.5rem' }],
        '5xl': ['2.5rem', { lineHeight: '3rem' }],
        '6xl': ['3rem', { lineHeight: '3.5rem' }],
        '7xl': ['4rem', { lineHeight: '4.5rem' }],
        '8xl': ['5rem', { lineHeight: '1' }],
        '9xl': ['6rem', { lineHeight: '1' }],
        '10xl': ['8rem', { lineHeight: '1' }],
      },
    },
  },
  // safelist: generateSafelist(),
});
