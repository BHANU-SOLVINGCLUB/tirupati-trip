import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow builds to succeed even if there are lint errors; we still run lint in CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds even if there are type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
