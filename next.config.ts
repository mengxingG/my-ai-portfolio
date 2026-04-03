import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Route Handler 中保持这些库为 Node 外部依赖
  serverExternalPackages: ["mammoth", "undici", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
