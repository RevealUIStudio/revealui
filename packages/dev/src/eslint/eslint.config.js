export default {
  ignores: [
    'node_modules/',
    'dist/',
    'build/',
    'env.d.ts',
    '.env',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    '.vite/',
    'framework/',
    '.next/',
  ],
  rules: {
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
  },
  settings: {
    react: {
      version: 'detect', // Automatically detect React version
    },
    'import/resolver': {
      node: {
        paths: ['src'], // Helps resolve imports using absolute paths
      },
    },
    tailwindcss: {
      config: '../tailwind/tailwind.config.js', // Custom Tailwind config
    },
  },
}
