/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the pure-TS domain layer free of server-only constraints.
    serverComponentsExternalPackages: ["@prisma/client", "googleapis"],
  },
  images: {
    // Signed URLs from the private Supabase 'alwalaa' bucket — the ONLY
    // external image host the optimizer will touch (no hotlinking).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
