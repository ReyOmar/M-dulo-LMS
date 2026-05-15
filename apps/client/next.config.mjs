import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Resolve multi-lockfile warning by explicitly pointing to monorepo root
  outputFileTracingRoot: resolve(__dirname, "../../"),
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  reactStrictMode: true,
  // Optimize chunk splitting for faster LCP
  experimental: {
    optimizePackageImports: [
      "lucide-react",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
