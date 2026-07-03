import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB — iPhone camera photos exceed that and Safari shows a
      // generic "this page couldn't load" on the failed POST.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: configDirectory,
  },
};

export default nextConfig;
