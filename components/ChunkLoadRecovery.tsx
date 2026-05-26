"use client";

import { useEffect } from "react";
import {
  clearChunkReloadFlag,
  isChunkLoadError,
  reloadOnceOnChunkError,
} from "@/lib/chunk-load-error";

/**
 * 监听全局 chunk 加载失败并自动刷新一次。
 * 横纵分析等长任务在 dev 下若触发 HMR，旧 chunk 会 404 并抛出 ChunkLoadError。
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    clearChunkReloadFlag();

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) {
        reloadOnceOnChunkError();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnceOnChunkError();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
