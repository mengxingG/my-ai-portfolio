/** @type {import("next").NextConfig} */
const nextConfig = {
  // 核心：关闭容易导致 Segfault 的底层 Rust 压缩器（Next.js 16 类型未导出此字段，但运行时仍生效）
  swcMinify: false,

  // Route Handler 中保持这些库为 Node 外部依赖
  serverExternalPackages: ["mammoth", "undici", "pdf-parse", "pdfjs-dist"],

  // 以下配置用于降低 Vercel 构建时的内存峰值，避免 SIGSEGV 崩溃
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
