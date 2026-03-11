/** @type {import('next').NextConfig} */
const nextConfig = {
  // Solo usar 'export' en build de producción, no en dev
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_EXPORT === 'true' 
    ? { output: 'export' } 
    : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.firebasestorage.app',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      }
    ],
  },
}

export default nextConfig
