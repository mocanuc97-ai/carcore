import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Help Next pick the correct workspace root when multiple lockfiles exist (fixes route/404 issues in E2E)
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
