import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app folder so Turbopack does not pick up
  // ancestor lockfiles (e.g. C:\Users\Pedro\package-lock.json).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
