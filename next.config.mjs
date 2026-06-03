/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse is CommonJS and tries to read a test PDF at module load —
  // keeping it external prevents the Next bundler from rewriting it.
  serverExternalPackages: ["pdf-parse"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
