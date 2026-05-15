import type { NextConfig } from "next";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  output: "standalone",
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost"
  ],
  webpack: (config) => {
    // The orphaned src/frontend/node_modules directory (no package.json) creates
    // a duplicate React instance that causes null useContext errors at build time.
    // Strip that path from the module search list so webpack always resolves
    // packages through the single authoritative root node_modules.
    const frontendNodeModules = path.resolve(__dirname, "node_modules");
    if (Array.isArray(config.resolve?.modules)) {
      config.resolve.modules = config.resolve.modules.filter(
        (m: string) => typeof m !== "string" || !m.startsWith(frontendNodeModules)
      );
    }
    return config;
  },
};

export default nextConfig;
