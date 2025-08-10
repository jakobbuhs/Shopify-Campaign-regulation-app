/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export', // optional: only if you truly want static export
    async rewrites() {
      return [{ source: '/api/:path*', destination: 'http://localhost:10000/:path*' }];
    },
  };
  module.exports = nextConfig;
  