import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB — iPhone camera photos exceed that and Safari shows a
      // generic "this page couldn't load" on the failed POST.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
