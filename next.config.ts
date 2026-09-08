import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained Node server for the Droplet image. This avoids
  // running `next start` or copying the whole working tree at runtime.
  // Windows checkouts cannot always create pnpm package symlinks. Local
  // production previews use next start; Linux/Docker keeps standalone output.
  ...(process.platform === "win32" ? {} : { output: "standalone" as const }),
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
