import type { NextConfig } from "next";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../");

// CSP is set dynamically per-request in middleware.ts (nonce-based).
// Only static security headers that don't need per-request variation live here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  output: "standalone",
  serverExternalPackages: ["applicationinsights", "@azure/monitor-opentelemetry", "@azure/monitor-opentelemetry-exporter"],
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost"
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
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
