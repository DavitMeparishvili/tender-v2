import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained Node server for the Droplet image. This avoids
  // running `next start` or copying the whole working tree at runtime.
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
