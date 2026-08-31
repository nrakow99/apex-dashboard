/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/compliance", destination: "/today", permanent: true },
      { source: "/trades", destination: "/review", permanent: true },
      { source: "/analytics", destination: "/review?tab=edge", permanent: true },
    ]
  },
}

export default nextConfig
