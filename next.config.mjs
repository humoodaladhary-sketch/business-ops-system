/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the pure-TS domain layer free of server-only constraints.
    serverComponentsExternalPackages: ["@prisma/client", "googleapis"],
    // The CEO Command Center reads its dataset from data/ceo at request time, so
    // those files must ship with the serverless function that serves the copilot.
    outputFileTracingIncludes: {
      "/api/copilot": ["./data/ceo/**"],
    },
  },
};

export default nextConfig;
