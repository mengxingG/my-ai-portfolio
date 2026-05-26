/** 判断是否为 Next/Webpack 的 chunk 加载失败（开发 HMR 或部署后旧页面常见） */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: string }).name)
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: string }).message)
      : typeof error === "string"
        ? error
        : "";
  const combined = `${name} ${message}`;
  return (
    /ChunkLoadError/i.test(combined) ||
    /Loading chunk \d+ failed/i.test(combined) ||
    /Failed to load chunk/i.test(combined) ||
    /Failed to fetch dynamically imported module/i.test(combined)
  );
}

const RELOAD_FLAG = "portfolio-chunk-reload-once";

/** 开发/部署后 chunk 失效时自动刷新一次，避免卡在 Runtime ChunkLoadError */
export function reloadOnceOnChunkError(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

/** 页面成功加载后清除刷新标记，便于下次仍可自动恢复 */
export function clearChunkReloadFlag(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}
