import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB request body cap, which is well
    // under the media-upload feature's own documented limits (5MB image /
    // 16MB video, lib/actions/automation-media.ts). This only raises the
    // transport ceiling so those uploads can reach that validation at
    // all -- it does not change or replace it.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
