/** @type {import("next").NextConfig} */
const nextConfig = {
  // Route Handler 中保持这些库为 Node 外部依赖
  serverExternalPackages: ["mammoth", "undici", "pdf-parse", "pdfjs-dist"],

  // 以下配置用于降低 Vercel 构建时的内存峰值，避免 SIGSEGV 崩溃
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
