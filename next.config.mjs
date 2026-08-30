/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is run separately; don't block the production build on style rules.
  eslint: { ignoreDuringBuilds: true },
  // The IoT simulator + AI layer run in-process; keep server components lean.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
