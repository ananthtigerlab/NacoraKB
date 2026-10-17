/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 moved this out of `experimental`.
  // These are Node-only packages that touch the filesystem / native modules and must NOT be
  // bundled into the server component graph — they run as regular Node imports at request time.
  serverExternalPackages: [
    '@electric-sql/pglite',
    'pdf-parse',
    'mammoth',
    'tesseract.js',
    'simple-git',
  ],
  // Empty turbopack config so Next.js knows we've intentionally opted in and stops warning.
  turbopack: {},
  allowedDevOrigins: ['192.168.0.*', '192.168.1.*', '10.0.0.*'],
};

module.exports = nextConfig;
