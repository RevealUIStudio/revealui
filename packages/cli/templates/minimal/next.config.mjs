/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
  // Required for RevealUI CMS admin panel
  transpilePackages: ['@revealui/core', '@revealui/presentation'],
}

export default nextConfig
