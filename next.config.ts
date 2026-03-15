import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WASM support for @provablehq/sdk (future)
  // webpack config kept for production builds; turbopack for dev
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  turbopack: {},
};

export default nextConfig;
