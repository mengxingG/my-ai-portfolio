import type { NextConfig } from "next";

const CHROMIUM_TRACE_GLOBS = [
  "./node_modules/@sparticuz/chromium/bin/**",
  "./node_modules/@sparticuz/chromium/build/**",
];

/** @type {import("next").NextConfig} */
const nextConfig: NextConfig = {
  // Route Handler 中保持这些库为 Node 外部依赖（勿被 webpack 打包，否则 bin 路径失效）
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "mammoth", "undici", "pdf-parse", "pdfjs-dist"],

  // Vercel 部署时必须显式追踪 chromium 二进制（约 70MB），否则 /var/task/.../bin 不存在
  outputFileTracingIncludes: {
    "/api/hv-analysis/pdf": CHROMIUM_TRACE_GLOBS,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      const extras = ["@sparticuz/chromium", "puppeteer-core"];
      if (Array.isArray(config.externals)) {
        config.externals.push(...extras);
      } else if (config.externals) {
        config.externals = [config.externals, ...extras];
      } else {
        config.externals = extras;
      }
    }
    return config;
  },

  // 以下配置用于降低 Vercel 构建时的内存峰值，避免 SIGSEGV 崩溃
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
