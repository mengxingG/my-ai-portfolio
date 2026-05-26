"use client";

import { useEffect } from "react";
import {
  isChunkLoadError,
  reloadOnceOnChunkError,
} from "@/lib/chunk-load-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkFailed = isChunkLoadError(error);

  useEffect(() => {
    if (chunkFailed) {
      reloadOnceOnChunkError();
    }
  }, [chunkFailed]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090b] px-6 text-center text-slate-200">
      <h2 className="text-lg font-semibold">
        {chunkFailed ? "页面资源已更新" : "页面运行出错"}
      </h2>
      <p className="max-w-md text-sm text-slate-400">
        {chunkFailed
          ? "开发服务器重新编译后，浏览器里的旧代码块已失效。正在尝试自动刷新；若未刷新，请手动点击下方按钮。"
          : error.message || "发生了未知错误，请重试。"}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (chunkFailed ? window.location.reload() : reset())}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
        >
          {chunkFailed ? "刷新页面" : "重试"}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-white/25"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
