/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the pure-TS domain layer free of server-only constraints.
    serverComponentsExternalPackages: ["@prisma/client", "googleapis"],
  },
};

export default nextConfig;
