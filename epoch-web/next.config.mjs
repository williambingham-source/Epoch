/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@excalidraw/excalidraw', '@excalidraw/utils', '@excalidraw/math'],
};

export default nextConfig;
