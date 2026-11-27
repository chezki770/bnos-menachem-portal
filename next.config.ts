import type { NextConfig } from 'next';

const config: NextConfig = {
  // Self-contained server build for the Docker image (see Dockerfile).
  output: 'standalone',
  // The CSV store reads DATA_DIR at run time, so the file tracer can't tell which folders it uses and
  // would copy the whole project into .next/standalone. Keep data, backups and source out.
  // (Next.js always copies a local .env into standalone output; the Docker build never sees .env
  // because .dockerignore excludes it.)
  outputFileTracingExcludes: {
    '/*': [
      './data/**',
      './backups/**',
      './.git/**',
      './src/**',
      './scripts/**',
      './dev-setup/**',
      './*.html',
      './*.md',
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
