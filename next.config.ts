import type { NextConfig } from "next";
import crypto from "crypto";

const isDev = process.env.NODE_ENV === 'development';

// Use stable token from env so sessions survive server restarts.
// Falls back to a random UUID only if APP_SESSION_TOKEN is not set.
const RUNTIME_TOKEN = process.env.APP_SESSION_TOKEN || crypto.randomUUID();

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],

  // Expose runtime token to Edge middleware (changes every restart)
  env: {
    RUNTIME_TOKEN,
  },

  // Pin Turbopack workspace root to this project
  turbopack: { root: __dirname },

  // Skip type-checking during dev
  typescript: { ignoreBuildErrors: isDev },

  // Performance: disable source maps in production
  productionBrowserSourceMaps: false,

  // Performance: compress responses
  compress: true,

  images: {
    // Disable Sharp optimization — avoids "received null" errors on Windows.
    // All image rendering in this app uses plain <img> tags, so this is safe.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: '*.together.ai' },
      { protocol: 'https', hostname: 'api.together.xyz' },
    ],
    minimumCacheTTL: 86400,
  },

  // Performance: HTTP headers for static asset caching
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

export default nextConfig;
