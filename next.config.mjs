/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // A self-hosted image ships only the files the server actually needs.
  // Vercel builds without it, as it handles packaging itself.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
}

export default nextConfig
