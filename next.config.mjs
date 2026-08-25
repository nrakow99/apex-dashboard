/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
  },
}

export default nextConfig
