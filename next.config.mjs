/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // A self-hosted image ships only the files the server actually needs.
  // Vercel builds without it, as it handles packaging itself.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // The development badge sits in the bottom-left corner, exactly where the
  // phone tab bar puts "Главная" — it covers the tab and swallows the tap,
  // both for a person testing on a phone and for the browser suites.
  devIndicators: false,
}

export default nextConfig
