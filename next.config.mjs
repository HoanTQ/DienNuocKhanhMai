/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Bỏ qua ESLint errors khi build (đã lint riêng)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Bỏ qua TypeScript errors khi build (đã check riêng)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
