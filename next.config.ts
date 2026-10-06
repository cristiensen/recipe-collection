import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    qualities: [75],
  },
  experimental: {
    // Recipe form payloads are JSON (media is uploaded directly to storage).
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
