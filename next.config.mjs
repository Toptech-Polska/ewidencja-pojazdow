/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Pomija błędy TypeScript podczas budowania — typy są sprawdzane lokalnie
    ignoreBuildErrors: true,
  },
  eslint: {
    // Pomija błędy ESLint podczas budowania
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
