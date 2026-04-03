"use client";

import {
  Suspense,
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import {
  BriefcaseBusiness,
  Hourglass,
  Lightbulb,
  Maximize,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Shuffle,
  Sparkles,
  Trash2,
  Video,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
  Pencil,
} from "lucide-react";
import { InterviewVoiceUI } from "@/app/components/InterviewVoiceUI";
import { fixMermaidMindmapInnerSource } from "@/lib/fixMermaidMindmapIndent";
import { trimMermaidSvgToContent } from "@/lib/trimMermaidSvgViewBox";
import { isVideoWatchUrl } from "@/lib/videoWatchUrl";
import { PDFDocument } from "pdf-lib";
import type { ElementContent, Root as HastRoot } from "hast";

/** 仅在筛选时启用：给 hast 根节点包一层 div，供 components.div 识别并做文本高亮（react-markdown v10 无 components.root） */
function rehypeWrapOutlineSearchShell() {
  return function transformTree(tree: HastRoot) {
    const ch = tree.children;
    if (!ch?.length) return;
    tree.children = [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["md-outline-search-shell"] },
        children: [...ch] as ElementContent[],
      },
    ];
  };
}

function classNameTokens(className: unknown): string[] {
  if (className == null) return [];
  if (typeof className === "string") return className.split(/\s+/).filter(Boolean);
  if (Array.isArray(className))
    return className.flatMap((c) => String(c).split(/\s+/).filter(Boolean));
  return [];
}

export const dynamic = "force-dynamic";

/** 与 Learning Dashboard「资料类型」一致 */
const UPLOAD_MATERIAL_TYPE_OPTIONS = [
  "小红书",
  "B站",
  "YouTube",
  "PDF",
  "视频链接",
  "网页文章",
  "图片截图",
  "PRD",
  "未分类",
] as const;

type VideoRecSource = "YouTube" | "B站" | "小红书";

type LearningTabKey = "raw" | "outline" | "diagram" | "library";
type OutlineStep = 1 | 2 | 3 | 4;
type TimerState = "idle" | "focusing" | "completed";
type PetId = 25 | 1 | 7 | 6;

type ChatRole = "assistant" | "user";

type ChatActionKey = "petReward";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  actionKey?: ChatActionKey;
};

type LearningModeKey = "story" | "interview";

type KnowledgeItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  difficulty: string;
  durationMinutes: number | null;
  keywords: string[];
};

type KnowledgeDetail = KnowledgeItem & {
  rawText: string;
  videoLinks: string[];
  coreKeywords: string[];
  outlineMarkdown: string;
};

type IngestSseEvent =
  | { event: "rawTextChunk"; data: { text: string } }
  | { event: "aiDelta"; data: { delta: string } }
  | { event: "aiFull"; data: { text: string } }
  | { event: "traceWarn"; data: { message: string } }
  | { event: "done"; data: { pageId: string; title?: string } }
  | { event: "error"; data: { message: string } };

function MermaidMindmapZoomToolbar({
  controls,
  className,
  onFitView,
  onFullscreen,
}: {
  controls: ReactZoomPanPinchContentRef;
  /** 自定义容器（如全屏弹层顶栏）；不传则用内嵌卡片顶栏样式 */
  className?: string;
  /** 若提供，「复位」改为铺满可视区域（适应视图），而非 initialScale */
  onFitView?: () => void;
  onFullscreen?: () => void;
}) {
  const wrapClass =
    className ??
    "flex flex-wrap items-center justify-end gap-1.5 border-b border-white/10 bg-black/35 px-2 py-2";
  const showHint = !className;
  return (
    <div className={wrapClass}>
      {showHint ? (
        <span className="mr-auto hidden text-[11px] text-slate-500 sm:inline">
          滚轮缩放 · 拖拽平移
        </span>
      ) : null}
      {onFullscreen ? (
        <button
          type="button"
          onClick={onFullscreen}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 text-cyan-100 hover:bg-cyan-500/20"
          aria-label="全屏查看思维导图"
          title="全屏"
        >
          <Maximize className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => controls.zoomIn(0.2)}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-slate-200 hover:bg-white/[0.09]"
        aria-label="放大"
        title="放大"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => controls.zoomOut(0.2)}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-slate-200 hover:bg-white/[0.09]"
        aria-label="缩小"
        title="缩小"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => (onFitView ? onFitView() : controls.resetTransform())}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.09]"
        aria-label={onFitView ? "视图复位为铺满可视区域" : "复位缩放与位置"}
        title={onFitView ? "适应视图" : "复位"}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {onFitView ? "适应" : "复位"}
      </button>
    </div>
  );
}

function fitMindmapZoomToView(
  controls: Pick<ReactZoomPanPinchContentRef, "zoomToElement" | "centerView">,
  getShell: () => HTMLElement | null
) {
  const attempt = (n: number) => {
    const shell = getShell();
    const svg = shell?.querySelector("svg");
    if (svg) {
      controls.zoomToElement(svg as unknown as HTMLElement, undefined, 0);
      return;
    }
    if (n < 90) {
      requestAnimationFrame(() => attempt(n + 1));
      return;
    }
    controls.centerView(1, 0);
  };
  requestAnimationFrame(() => attempt(0));
}

function MermaidBlock({
  code,
  zoomable = false,
  className = "",
  zoomLayout = "embedded",
  onRequestFullscreen,
}: {
  code: string;
  zoomable?: boolean;
  className?: string;
  /** embedded：左栏默认高度；fullscreen：全屏弹层内铺满视口 */
  zoomLayout?: "embedded" | "fullscreen";
  onRequestFullscreen?: () => void;
}) {
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef(`mmd-${nowId()}`);
  const zoomShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setErr(null);
    setSvg("");

    const raw = String(code || "").trim();
    const src = fixMermaidMindmapInnerSource(raw);
    if (!src) return;

    void (async () => {
      try {
        const { svg: rawSvg } = await mermaid.render(idRef.current, src);
        if (!active) return;
        const trimmed = zoomable ? trimMermaidSvgToContent(rawSvg) : rawSvg;
        setSvg(trimmed);
      } catch (e) {
        if (!active) return;
        setErr(e instanceof Error ? e.message : "Mermaid 渲染失败");
      }
    })();

    return () => {
      active = false;
    };
  }, [code, zoomable]);

  if (err) {
    return (
      <div className="my-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100/90">
        Mermaid 渲染失败：{err}
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px] text-slate-200">
          {fixMermaidMindmapInnerSource(String(code || "").trim())}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-400">
        正在渲染 Mermaid...
      </div>
    );
  }

  const svgHostClass = zoomable
    ? "inline-block min-w-0 max-w-none [&_svg]:block [&_svg]:max-h-none [&_svg]:max-w-none"
    : "[&_svg]:max-w-none";

  const svgNode = (
    <div
      ref={zoomable ? zoomShellRef : undefined}
      className={svgHostClass}
      // mermaid.render 返回的是 SVG 字符串
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );

  if (!zoomable) {
    return (
      <div className="my-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-3">
        {svgNode}
      </div>
    );
  }

  const isFullscreenLayout = zoomLayout === "fullscreen";

  return (
    <div
      className={[
        isFullscreenLayout
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40"
          : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-white/10 bg-black/25 sm:rounded-2xl sm:border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <TransformWrapper
        initialScale={1}
        minScale={0.05}
        maxScale={isFullscreenLayout ? 8 : 5}
        centerOnInit
        wheel={{ step: 0.12 }}
        pinch={{ step: 8 }}
        panning={{ velocityDisabled: true }}
        onInit={(api) => {
          fitMindmapZoomToView(api, () => zoomShellRef.current);
        }}
      >
        {(controls) => (
          <>
            <MermaidMindmapZoomToolbar
              controls={controls}
              onFitView={() => fitMindmapZoomToView(controls, () => zoomShellRef.current)}
              onFullscreen={isFullscreenLayout ? undefined : onRequestFullscreen}
            />
            <TransformComponent
              wrapperClass="!w-full !max-w-none flex-1 min-h-0 min-w-0"
              wrapperStyle={
                isFullscreenLayout
                  ? {
                      minHeight: 0,
                      height: "100%",
                      width: "100%",
                      flex: "1 1 auto",
                      touchAction: "none",
                    }
                  : {
                      minHeight: "clamp(360px, calc(100vh - 220px), 1200px)",
                      width: "100%",
                      flex: "1 1 auto",
                      touchAction: "none",
                    }
              }
              contentClass={
                isFullscreenLayout
                  ? "flex h-full min-h-0 w-full min-w-0 items-start justify-stretch p-3 sm:p-6"
                  : "flex min-h-[clamp(360px,calc(100vh-220px),1200px)] w-full min-w-0 items-start justify-stretch p-2 sm:p-4"
              }
            >
              {svgNode}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

/** 筛选时仍走 Markdown 渲染；仅在文本节点上包 mark，避免整段当纯文本出现 ##、- 字面量 */
function splitOutlineTextWithHighlights(
  text: string,
  qTrim: string,
  ordBox: { n: number },
  activeIdx: number,
  markRefs: React.MutableRefObject<Record<number, HTMLSpanElement | null>>
): ReactNode {
  if (!qTrim) return text;
  const tLower = text.toLowerCase();
  const qLower = qTrim.toLowerCase();
  const qLen = qTrim.length;
  const parts: ReactNode[] = [];
  let pos = 0;
  while (pos <= tLower.length - qLen) {
    const f = tLower.indexOf(qLower, pos);
    if (f === -1) break;
    if (f > pos) parts.push(text.slice(pos, f));
    const myIdx = ordBox.n;
    ordBox.n += 1;
    parts.push(
      <mark
        key={`oh-${myIdx}-${f}`}
        data-outline-hit=""
        ref={(el) => {
          markRefs.current[myIdx] = el;
        }}
        className={
          myIdx === activeIdx
            ? "rounded-sm bg-yellow-300/55 px-[1px] text-slate-50"
            : "rounded-sm bg-yellow-200/25 px-[1px] text-slate-50"
        }
      >
        {text.slice(f, f + qLen)}
      </mark>
    );
    pos = f + qLen;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  if (parts.length === 0) return text;
  if (parts.length === 1) return parts[0];
  return <>{parts}</>;
}

function wrapOutlineMarkdownChildren(
  children: ReactNode,
  qTrim: string,
  ordBox: { n: number },
  activeIdx: number,
  markRefs: React.MutableRefObject<Record<number, HTMLSpanElement | null>>
): ReactNode {
  if (!qTrim) return children;
  return Children.map(Children.toArray(children), (child, i) => {
    if (typeof child === "string") {
      return splitOutlineTextWithHighlights(child, qTrim, ordBox, activeIdx, markRefs);
    }
    if (!isValidElement(child)) return child;

    if (child.type === MermaidBlock) return child;

    const tag = typeof child.type === "string" ? child.type : "";
    if (tag === "pre" || tag === "script" || tag === "style") return child;

    if (child.type === Fragment) {
      const ch = (child.props as { children?: ReactNode }).children;
      return (
        <Fragment key={child.key ?? i}>
          {wrapOutlineMarkdownChildren(ch, qTrim, ordBox, activeIdx, markRefs)}
        </Fragment>
      );
    }

    const el = child as ReactElement<{ children?: ReactNode; className?: string }>;
    const inner = el.props.children;
    return cloneElement(el, {
      key: child.key ?? i,
      children: wrapOutlineMarkdownChildren(inner, qTrim, ordBox, activeIdx, markRefs),
    });
  });
}

function MermaidViewer({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef(`mmd-view-${nowId()}`);

  useEffect(() => {
    let active = true;
    setErr(null);
    setSvg("");
    const raw = String(code || "").trim();
    const src = fixMermaidMindmapInnerSource(raw);
    if (!src) return;

    void (async () => {
      try {
        const { svg: raw } = await mermaid.render(idRef.current, src);
        if (!active) return;
        setSvg(trimMermaidSvgToContent(raw));
      } catch (e) {
        if (!active) return;
        setErr(e instanceof Error ? e.message : "Mermaid 渲染失败");
      }
    })();

    return () => {
      active = false;
    };
  }, [code]);

  if (err) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
        Mermaid 渲染失败：{err}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        正在渲染知识图谱...
      </div>
    );
  }

  return (
    <div
      className="inline-block max-w-none [&_svg]:block [&_svg]:max-w-none"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function buildBilibiliSearchUrl(keyword: string) {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
}

function buildYouTubeSearchUrl(keyword: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`;
}

function guessVideoSource(url: string): VideoRecSource {
  const u = (url || "").toLowerCase();
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "小红书";
  if (u.includes("bilibili.com") || u.includes("b23.tv")) return "B站";
  return "YouTube";
}

function shortVideoLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const p = u.pathname.replace(/\/+$/, "");
    const last = p.split("/").filter(Boolean).pop() ?? "";
    const q = u.searchParams.get("v") ?? "";
    const id = q || last;
    return id ? `${host} · ${id}` : host;
  } catch {
    return url;
  }
}

/** 与 ingest 置顶行一致：`资料来源：{url}` */
function extractMaterialSourceUrlFromRawText(rawText: string): string | null {
  const t = String(rawText ?? "").replace(/\r\n/g, "\n");
  if (!t.trim()) return null;
  const head = t.split(/\n\n+/)[0] ?? t;
  for (const line of head.split("\n")) {
    const m = line.match(/^\s*资料来源[：:]\s*(.+?)\s*$/);
    const u = m?.[1]?.trim();
    if (u) return u;
  }
  return null;
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPdfFileClient(f: File) {
  const name = (f.name || "").toLowerCase();
  const type = (f.type || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

/** 读取 ingest 的 text/plain 流，将可见正文写入 basePrefix + 片段内容，并解析尾部标记 */
async function readIngestTextStream(
  res: Response,
  basePrefix: string,
  onBufferUpdate: (fullDisplay: string) => void
): Promise<{ pageId: string; streamError: string }> {
  if (!res.body) {
    return { pageId: "", streamError: "服务器未返回可读取的流（response.body 为空）。" };
  }
  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let full = "";
    let pageId = "";
    let streamError = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      const pageIdx = full.indexOf("[[NOTION_PAGE_ID]]:");
      const errIdx = full.indexOf("[[ERROR]]:");
      if (errIdx >= 0) {
        const head = full.slice(0, errIdx);
        const tail = full.slice(errIdx);
        const m = tail.match(/^\[\[ERROR\]\]:(.*)$/m);
        streamError = (m?.[1] ?? "").trim() || "Unknown error";
        onBufferUpdate(basePrefix + head);
        break;
      }
      if (pageIdx >= 0) {
        const head = full.slice(0, pageIdx);
        const tail = full.slice(pageIdx);
        const m = tail.match(/^\[\[NOTION_PAGE_ID\]\]:(.*)$/m);
        pageId = (m?.[1] ?? "").trim();
        onBufferUpdate(basePrefix + head);
        break;
      }
      onBufferUpdate(basePrefix + full);
    }
    return { pageId, streamError };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "读取响应流时出错";
    return { pageId: "", streamError: msg };
  }
}

const PET_NAMES: Record<PetId, string> = {
  25: "皮卡丘",
  1: "妙蛙种子",
  7: "杰尼龟",
  6: "喷火龙",
};

const PET_UNLOCK_LEVEL: Record<PetId, number> = {
  25: 1,
  1: 2,
  7: 3,
  6: 4,
};

function getPetSprite(petId: PetId, timerState: TimerState): string {
  if (timerState === "focusing") {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${petId}.gif`;
  }
  if (timerState === "completed") {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/${petId}.gif`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${petId}.png`;
}

function RecommendedVideoCard({
  videos,
}: {
  videos: Array<{
    id: string;
    title: string;
    source: VideoRecSource;
    url: string;
  }>;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Video className="h-4 w-4 text-cyan-300" />
            <span>相关视频推荐</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            基于你当前的学习主题，动态匹配高相关内容（占位逻辑）。
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-mono text-cyan-200">
          3 mins · Quick Win
        </div>
      </div>

      <div className="mt-4">
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
          {videos.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noreferrer"
              className="w-[220px] shrink-0 rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-white/10 bg-gradient-to-br from-cyan-500/15 via-purple-500/10 to-transparent">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-slate-100">
                    <span className="inline-block h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.35)]" />
                    <span className="font-medium">Play</span>
                  </div>
                </div>
                <div className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-mono text-slate-200">
                  {v.source}
                </div>
                <div className="absolute bottom-2 right-2 rounded-full border border-white/10 bg-black/35 p-2">
                  <Play className="h-3.5 w-3.5 text-cyan-200" />
                </div>
              </div>

              <div className="mt-3 min-h-[2.6rem]">
                <div className="line-clamp-2 text-sm font-medium text-slate-100">
                  {v.title}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-mono">open</span>
                <span className="inline-flex items-center gap-1">
                  <Volume2 className="h-3.5 w-3.5" />
                  audio
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =======================================
 * Left: NotebookLM Summary (低认知负荷)
 * ======================================= */
function TLDRCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-cyan-500/20 bg-black/20 p-2">
          <Lightbulb className="h-4 w-4 text-cyan-200" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-mono text-cyan-200/80">TL;DR</div>
          <div className="mt-1 text-sm leading-relaxed text-slate-100/95">{text}</div>
        </div>
      </div>
    </div>
  );
}

function ConceptChips({ items }: { items: string[] }) {
  return (
    <div>
      <div className="text-xs font-mono text-slate-400">核心概念切片</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((x) => (
          <button
            key={x}
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-100"
            aria-label={`Concept chip: ${x}`}
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}

function LogicChain({
  steps,
}: {
  steps: Array<{ title: string; desc?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs font-mono text-slate-400">极简业务链路</div>
      <div className="mt-3 space-y-3">
        {steps.map((s, idx) => (
          <div key={`${idx}-${s.title}`} className="relative pl-8">
            <div className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[11px] font-mono text-slate-200">
              {idx + 1}
            </div>
            <div className="text-sm font-semibold text-slate-100">{s.title}</div>
            {s.desc ? (
              <div className="mt-1 text-xs leading-relaxed text-slate-400">{s.desc}</div>
            ) : null}
            {idx < steps.length - 1 ? (
              <div className="mt-3 ml-2 h-4 w-px bg-white/10" aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MicroCheck({
  question,
  onAnswer,
}: {
  question: string;
  onAnswer: (answer: "A" | "B") => void;
}) {
  return (
    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 shadow-sm">
      <div className="text-xs font-mono text-purple-200/80">迷你试金石</div>
      <div className="mt-2 text-sm leading-relaxed text-slate-100/95">{question}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAnswer("A")}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-100"
        >
          A. 遗忘长文本
        </button>
        <button
          type="button"
          onClick={() => onAnswer("B")}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500/25 hover:bg-rose-500/10 hover:text-rose-100"
        >
          B. 翻译提速
        </button>
      </div>
    </div>
  );
}

/* ================================
 * Left: Upload Modal (资料上传与整理)
 * ================================ */
function AddResourceModal({
  open,
  onClose,
  onNotebookLMStart,
  streaming,
  streamText,
  streamBufferLen,
  streamError,
  deepProgressLabel,
  mermaidCode,
  onOpenMap,
}: {
  open: boolean;
  onClose: () => void;
  onNotebookLMStart: (payload: {
    files: File[];
    pastedText: string;
    modelId: string;
    sourceUrl: string;
    materialType: string;
  }) => Promise<void> | void;
  streaming: boolean;
  streamText: string;
  /** 网络已收到的总长度；用于「仍在打字追上」时保持光标 */
  streamBufferLen: number;
  streamError: string | null;
  deepProgressLabel: string | null;
  mermaidCode: string | null;
  onOpenMap: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [materialType, setMaterialType] = useState<string>("未分类");
  const [modelId, setModelId] = useState("gemini-2.5-flash");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uiPhase, setUiPhase] = useState<
    "idle" | "uploading" | "parsing" | "generating" | "syncing" | "done" | "error"
  >("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setPastedText("");
      setSourceUrl("");
      setMaterialType("未分类");
      setModelId("gemini-2.5-flash");
      setDragOver(false);
      setSubmitting(false);
      setUiPhase("idle");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (streamError) {
      setUiPhase("error");
      return;
    }
    if (!submitting && !streaming) {
      // If we have output and no streaming, likely done (Notion sync already happened server-side).
      if (streamText && streamText.length >= streamBufferLen && streamBufferLen > 0) {
        setUiPhase("done");
      } else {
        setUiPhase("idle");
      }
      return;
    }
    if (submitting && !streaming && !streamText) {
      setUiPhase("uploading");
      return;
    }
    if (streaming) {
      // Step simulation: parsing -> generating (timed)
      setUiPhase("parsing");
      const t = window.setTimeout(() => setUiPhase("generating"), 2400);
      return () => window.clearTimeout(t);
    }
    // streaming ended but typed text still catching up
    setUiPhase("syncing");
  }, [open, submitting, streaming, streamError, streamText, streamBufferLen]);

  useEffect(() => {
    if (!open) return;
    if (!terminalRef.current) return;
    if (!terminalBottomRef.current) return;
    // Smooth auto-scroll while typing/streaming.
    if (!streaming && streamText.length >= streamBufferLen) return;
    terminalBottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, streaming, streamText, streamBufferLen]);

  function normalizeFiles(list: FileList | null | undefined): File[] {
    const arr = list ? Array.from(list) : [];
    // Keep only common learning-related assets.
    const accept = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "text/plain",
    ]);
    return arr.filter((f) => accept.has(f.type) || /\.(pdf|doc|docx|png|jpg|jpeg|webp|gif|xmind|mind|mindmap|mm|txt)$/i.test(f.name));
  }

  function handleFilesSelected(list: FileList | null) {
    const next = normalizeFiles(list);
    setFiles(next);
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    const fixed = i === 0 ? 0 : v >= 10 ? 1 : 2;
    return `${v.toFixed(fixed)} ${units[i]}`;
  }

  function fileKindLabel(f: File) {
    const name = f.name.toLowerCase();
    const t = (f.type || "").toLowerCase();
    if (t === "application/pdf" || name.endsWith(".pdf")) return "PDF";
    if (name.endsWith(".doc") || name.endsWith(".docx")) return "DOC";
    if (t.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(name)) return "IMG";
    return "FILE";
  }

  async function handleStart() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onNotebookLMStart({ files, pastedText, modelId, sourceUrl, materialType });
      onClose();
    } catch (e) {
      if (e instanceof Error && e.name === "IngestUserError") {
        return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal */}
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/70 shadow-[0_30px_90px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        <style jsx>{`
          .notebook-scroll::-webkit-scrollbar {
            width: 10px;
          }
          .notebook-scroll::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.04);
            border-radius: 999px;
          }
          .notebook-scroll::-webkit-scrollbar-thumb {
            background: rgba(34, 211, 238, 0.22);
            border-radius: 999px;
            border: 2px solid rgba(0, 0, 0, 0.25);
          }
          .notebook-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(34, 211, 238, 0.32);
          }
        `}</style>
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">开始整理新资料</div>
            <div className="mt-1 text-xs text-slate-400">
              NotebookLM 模式：上传文档/截图，并可选附上外部 AI 总结。
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
            aria-label="Close modal"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 overflow-hidden px-5 py-4 md:grid-cols-[1.05fr_1.6fr]">
          {/* Left: Inputs — 中部滚动 + 底部操作条固定可见 */}
          <div className="flex h-full min-h-0 flex-col">
            <div className="notebook-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
            {/* Drop Zone / File Cards */}
            {!files.length ? (
              <div
                className={[
                  "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition",
                  dragOver
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-white/15 bg-white/[0.02] hover:border-cyan-500/35 hover:bg-white/[0.03]",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                onClick={() => inputRef.current?.click()}
                aria-label="Upload documents drop zone"
              >
                <div className="text-sm font-semibold text-slate-100">
                  拖拽文件到此处，或点击上传
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  支持：PDF / Word / MindMap / 截图
                </div>
                <div className="mt-4 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-mono text-slate-200 transition group-hover:bg-white/[0.05]">
                  未选择文件
                </div>
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(600px circle at 50% 20%, rgba(34,211,238,0.10), rgba(0,0,0,0) 55%)",
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${f.size}-${idx}`}
                    className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 ring-1 ring-white/5 transition hover:bg-white/[0.05]"
                    role="button"
                    tabIndex={0}
                    aria-label="Reselect files"
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                    }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-xs font-black tracking-wider text-cyan-200 ring-1 ring-cyan-500/20">
                      {fileKindLabel(f)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">
                        {f.name}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {formatBytes(f.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles([]);
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-slate-200 opacity-90 transition hover:bg-white/[0.05] group-hover:opacity-100"
                      aria-label="Clear selected files"
                      disabled={submitting || streaming || streamText.length < streamBufferLen}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            accept=".pdf,.doc,.docx,.xmind,.mind,.mm,.png,.jpg,.jpeg,.webp,.gif,.txt"
          />

            {/* External summary / pasted transcript */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold text-slate-300">
                粘贴视频文稿 / 外部 AI 总结
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="请在此粘贴从 Monica、Bilibili 或其他插件复制的视频亮点总结或完整字幕..."
                className="mt-2 box-border w-full resize-none overflow-y-auto h-32 max-h-48 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
                aria-label="Pasted external summary / transcript"
                disabled={submitting || streaming || streamText.length < streamBufferLen}
              />
              <div className="mt-3 text-xs font-semibold text-slate-300">内容来源链接（可选）</div>
              <input
                type="text"
                inputMode="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
                aria-label="Source link for pasted content"
                disabled={submitting || streaming || streamText.length < streamBufferLen}
              />
              <div className="mt-3 text-xs font-semibold text-slate-300">资料类型</div>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                disabled={submitting || streaming || streamText.length < streamBufferLen}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
                aria-label="Material type"
              >
                {UPLOAD_MATERIAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Model switcher */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-300">大模型选择</div>
                  <div className="mt-1 text-xs text-slate-500">
                    主模型拥堵（503）时可手动切换降级，无需重启服务。
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-mono text-slate-300">
                  {modelId}
                </div>
              </div>

              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={submitting || streaming || streamText.length < streamBufferLen}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
                aria-label="Model selector"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (极速首选)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (稳定备用)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度推理)</option>
                <optgroup label="备用（更细分）">
                  <option value="gemini-2.0-flash-001">gemini-2.0-flash-001</option>
                  <option value="gemini-2.0-flash-lite-001">gemini-2.0-flash-lite-001</option>
                  <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                  <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
                </optgroup>
              </select>
            </div>
            </div>

            {/* Footer actions / Status — 粘底，避免上方内容把按钮顶出视口 */}
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/10 bg-neutral-950/95 pt-3 pb-0 shadow-[0_-12px_32px_rgba(0,0,0,0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-neutral-950/85">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              {submitting || streaming || streamText.length < streamBufferLen ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-300">
                      {uiPhase === "uploading"
                        ? "正在上传至云端..."
                        : uiPhase === "parsing"
                          ? "多模态视觉引擎解析中..."
                          : uiPhase === "generating"
                            ? "正在生成结构化大纲..."
                            : uiPhase === "syncing"
                              ? "已成功同步至 Notion"
                              : "处理中..."}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {uiPhase === "uploading"
                        ? "step 1/4"
                        : uiPhase === "parsing"
                          ? "step 2/4"
                          : uiPhase === "generating"
                            ? "step 3/4"
                            : uiPhase === "syncing" || uiPhase === "done"
                              ? "step 4/4"
                              : "step"}
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.05] ring-1 ring-white/10">
                    <div
                      className={[
                        "h-full rounded-full bg-gradient-to-r from-cyan-400/70 via-sky-400/60 to-purple-400/60",
                        "animate-pulse",
                      ].join(" ")}
                      style={{
                        width:
                          uiPhase === "uploading"
                            ? "25%"
                            : uiPhase === "parsing"
                              ? "55%"
                              : uiPhase === "generating"
                                ? "80%"
                                : "100%",
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    {deepProgressLabel ? (
                      <span className="text-cyan-200/90">{deepProgressLabel}</span>
                    ) : files.length ? (
                      "提示：长 PDF 需要更久，请保持窗口打开。"
                    ) : (
                      "建议至少上传 1 份资料以获得更完整的大纲。"
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {files.length
                      ? "将把资料自动整理成大纲与关键原文（多模态）。"
                      : "建议至少上传 1 份资料以获得更完整的大纲。"}
                  </div>
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={submitting || streaming || streamText.length < streamBufferLen}
                    className="rounded-xl bg-cyan-500/15 px-5 py-3 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-500/25 transition hover:bg-cyan-500/20 disabled:opacity-60"
                  >
                    开始整理 (NotebookLM模式)
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Right: Notebook output terminal */}
          <div className="relative flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-black/30 p-4 ring-1 ring-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-300">
                Notebook 输出台
              </div>
              <div className="flex items-center gap-2">
                {streaming || streamText.length < streamBufferLen ? (
                  <div className="text-xs font-mono text-cyan-200/90">typing…</div>
                ) : streamText ? (
                  <div className="text-xs font-mono text-emerald-200/90">ready</div>
                ) : (
                  <div className="text-xs font-mono text-slate-500">idle</div>
                )}
              </div>
            </div>

            {streamError ? (
              <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-100/90">
                {streamError}
              </div>
            ) : null}

            <div
              ref={terminalRef}
              className="notebook-scroll mt-3 flex-1 h-full overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-4"
            >
              <div className="prose prose-invert max-w-none w-full prose-headings:scroll-mt-24 prose-a:text-cyan-300 prose-strong:text-slate-100 prose-li:marker:text-slate-500">
                {streamText ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const m = /language-(\w+)/.exec(className || "");
                        const lang = m?.[1] || "";
                        const raw = String(children ?? "");
                        if (lang === "mermaid") {
                          return <MermaidBlock code={raw} />;
                        }
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {streamText
                      .replace(/\\n/g, "\n")
                      .replace(/```mermaid[\s\S]*?```/m, "")
                      .trim()}
                  </ReactMarkdown>
                ) : submitting || streaming ? (
                  <div className="space-y-3">
                    <div className="h-4 w-2/3 animate-pulse rounded-lg bg-white/[0.08]" />
                    <div className="h-4 w-11/12 animate-pulse rounded-lg bg-white/[0.07]" />
                    <div className="h-4 w-9/12 animate-pulse rounded-lg bg-white/[0.06]" />
                    <div className="pt-2 text-[11px] font-mono text-cyan-200/80">
                      多模态引擎正在读取…请稍候
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    （这里会实时显示模型的结构化输出。建议先上传 PDF 后开始。）
                  </div>
                )}
              </div>
              {(streaming || streamText.length < streamBufferLen) ? (
                <div className="mt-2">
                  <span
                    className="inline-block h-3 w-0.5 animate-pulse bg-cyan-300/90 align-middle"
                    aria-hidden
                  />
                </div>
              ) : null}
              <div ref={terminalBottomRef} />
            </div>

            {mermaidCode ? (
              <button
                type="button"
                onClick={onOpenMap}
                className={[
                  "absolute right-4 top-4 inline-flex items-center gap-2 rounded-2xl border border-white/10",
                  "bg-black/40 px-4 py-2 text-xs font-semibold text-slate-100 backdrop-blur",
                  "shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10",
                  "transition hover:bg-black/55",
                  "animate-[pulse_2.4s_ease-in-out_infinite]",
                ].join(" ")}
                aria-label="Open global mind map"
              >
                <span className="text-base leading-none">🗺️</span>
                <span>全局知识图谱</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 与 refine API maxDuration=120s 对齐的乐观估计，用于前端进度条（非精确，仅缓解等待焦虑） */
const REFINE_CLIENT_ESTIMATE_MS = 85_000;

function LearningPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedTitle = searchParams.get("title")?.trim() || "";
  const linkedItemId = searchParams.get("itemId")?.trim() || "";

  const [linkedItem, setLinkedItem] = useState<KnowledgeItem | null>(null);
  const [linkedItemLoading, setLinkedItemLoading] = useState(false);
  const [linkedItemError, setLinkedItemError] = useState<string | null>(null);

  const [linkedDetail, setLinkedDetail] = useState<KnowledgeDetail | null>(null);
  const [linkedDetailLoading, setLinkedDetailLoading] = useState(false);
  const [linkedDetailError, setLinkedDetailError] = useState<string | null>(null);

  const [libraryItems, setLibraryItems] = useState<KnowledgeItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [tab, setTab] = useState<LearningTabKey>("raw");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const refineStartedAtRef = useRef(0);
  const [refineProgressTick, setRefineProgressTick] = useState(0);
  const [lastRefineModel, setLastRefineModel] = useState<string>("Gemini 3.1 Pro");
  const [rawCollapsed, setRawCollapsed] = useState(true);
  const [rawFontScale, setRawFontScale] = useState<number>(1);
  const [rawFilterQuery, setRawFilterQuery] = useState<string>("");
  const [outlineFilterQuery, setOutlineFilterQuery] = useState<string>("");
  const [outlineMatchIndex, setOutlineMatchIndex] = useState<number>(0);
  const [outlineHitCount, setOutlineHitCount] = useState(0);
  const outlineMatchElsRef = useRef<Record<number, HTMLSpanElement | null>>({});
  const outlineMarkdownMountRef = useRef<HTMLDivElement | null>(null);
  const [rawAnnotEnabled, setRawAnnotEnabled] = useState(false);
  const [rawAnnotTool, setRawAnnotTool] = useState<"highlighter" | "pen" | "eraser">(
    "highlighter"
  );
  const [rawAnnotSize, setRawAnnotSize] = useState<number>(6);
  const rawAnnotWrapRef = useRef<HTMLDivElement | null>(null);
  const rawAnnotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawAnnotLastPointRef = useRef<{ x: number; y: number } | null>(null);
  const rawAnnotIsDrawingRef = useRef(false);
  const rawAnnotImageDataUrlRef = useRef<string | null>(null);

  const [outlineAnnotEnabled, setOutlineAnnotEnabled] = useState(false);
  const [outlineAnnotTool, setOutlineAnnotTool] = useState<"highlighter" | "pen" | "eraser">(
    "highlighter"
  );
  const [outlineAnnotSize, setOutlineAnnotSize] = useState<number>(6);
  const outlineAnnotWrapRef = useRef<HTMLDivElement | null>(null);
  const outlineAnnotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outlineAnnotLastPointRef = useRef<{ x: number; y: number } | null>(null);
  const outlineAnnotIsDrawingRef = useRef(false);
  const outlineAnnotImageDataUrlRef = useRef<string | null>(null);

  const [ingestStreaming, setIngestStreaming] = useState(false);
  /** 网络层完整缓冲（由 chunk 更新）；展示层用 ingestTypedText 逐字追上 */
  const ingestBufferRef = useRef("");
  const ingestTypedLenRef = useRef(0);
  const [ingestBufferLen, setIngestBufferLen] = useState(0);
  const [ingestTypedText, setIngestTypedText] = useState("");
  const [ingestStreamError, setIngestStreamError] = useState<string | null>(null);
  /** 深度视觉模式：当前切片进度文案（例如「正在深度研读第 1-5 页…」） */
  const [deepProgressLabel, setDeepProgressLabel] = useState<string | null>(null);
  const [sessionRawText, setSessionRawText] = useState("");
  const [sessionAiSummary, setSessionAiSummary] = useState("");
  const sessionRawTextRef = useRef("");
  const sessionAiSummaryRef = useRef("");
  const ingestAbortRef = useRef<AbortController | null>(null);
  const mermaidInitedRef = useRef(false);
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  /** 思维导图 Tab：全屏沉浸查看 */
  const [diagramMindmapFullscreen, setDiagramMindmapFullscreen] = useState(false);
  const globalMapShellRef = useRef<HTMLDivElement | null>(null);
  const lastMermaidRef = useRef<string>("");
  const [currentStep, setCurrentStep] = useState<OutlineStep>(1);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<"none" | "correct" | "wrong">("none");

  const [titleEditMode, setTitleEditMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);

  useEffect(() => {
    setTitleEditMode(false);
  }, [linkedItemId]);

  useEffect(() => {
    if (tab !== "diagram") setDiagramMindmapFullscreen(false);
  }, [tab]);

  useEffect(() => {
    if (!diagramMindmapFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDiagramMindmapFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [diagramMindmapFullscreen]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLibraryLoading(true);
        setLibraryError(null);
        setLinkedItemLoading(Boolean(linkedItemId));
        setLinkedItemError(null);
        const res = await fetch("/api/knowledge", { cache: "no-store" });
        const data = (await res.json()) as { items?: KnowledgeItem[]; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items = rawItems.map((it) => ({
          ...it,
          keywords: Array.isArray(it.keywords) ? it.keywords : [],
        }));
        if (!active) return;
        setLibraryItems(items);
        if (linkedItemId) {
          const hit = items.find((i) => i.id === linkedItemId) ?? null;
          setLinkedItem(hit);
          if (!hit) setLinkedItemError("未找到该条目（可能已在 Notion 中删除或 id 变化）");
        } else {
          setLinkedItem(null);
          setLinkedItemError(null);
        }
      } catch (e) {
        if (!active) return;
        setLibraryItems([]);
        setLibraryError(e instanceof Error ? e.message : "加载失败");
        setLinkedItem(null);
        if (linkedItemId) setLinkedItemError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (active) {
          setLibraryLoading(false);
          setLinkedItemLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [linkedItemId]);

  useEffect(() => {
    return () => {
      try {
        ingestAbortRef.current?.abort();
      } catch {}
      ingestAbortRef.current = null;
    };
  }, []);

  /** 弹窗打开时：逐字「打字机」追上 ingestBufferRef（ChatGPT 风格，非逐 chunk） */
  useEffect(() => {
    if (!uploadOpen) return;
    const CHARS_PER_TICK = 3;
    const TICK_MS = 18;
    let stopped = false;
    const id = window.setInterval(() => {
      setIngestTypedText((prev) => {
        const target = ingestBufferRef.current;
        if (prev.length >= target.length) {
          ingestTypedLenRef.current = prev.length;
          if (!stopped) {
            stopped = true;
            window.clearInterval(id);
          }
          return prev;
        }
        const next = target.slice(0, Math.min(prev.length + CHARS_PER_TICK, target.length));
        ingestTypedLenRef.current = next.length;
        return next;
      });
    }, TICK_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [uploadOpen]);

  useEffect(() => {
    if (!uploadOpen) return;
    const src = ingestBufferRef.current || "";
    const m = src.match(/```mermaid\s*([\s\S]*?)```/m);
    const next = (m?.[1] ?? "").trim();
    if (next && next !== lastMermaidRef.current) {
      lastMermaidRef.current = next;
      setMermaidCode(next);
    }
  }, [uploadOpen, ingestBufferLen]);

  useEffect(() => {
    if (!uploadOpen) {
      setMermaidCode(null);
      lastMermaidRef.current = "";
      setIsMapOpen(false);
    }
  }, [uploadOpen]);

  useEffect(() => {
    if (!isMapOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMapOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMapOpen]);

  useEffect(() => {
    if (!uploadOpen) return;
    if (mermaidInitedRef.current) return;
    mermaidInitedRef.current = true;
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        flowchart: { curve: "basis" },
      });
    } catch {}
  }, [uploadOpen]);

  useEffect(() => {
    if (!uploadOpen) {
      ingestBufferRef.current = "";
      ingestTypedLenRef.current = 0;
      setIngestBufferLen(0);
      setIngestTypedText("");
      setIngestStreaming(false);
      setIngestStreamError(null);
      try {
        ingestAbortRef.current?.abort();
      } catch {}
      ingestAbortRef.current = null;
    }
  }, [uploadOpen]);

  const reloadLinkedDetail = useCallback(async () => {
    if (!linkedItemId) return;
    const res = await fetch(`/api/knowledge/${encodeURIComponent(linkedItemId)}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as { item?: KnowledgeDetail; error?: string };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    setLinkedDetail(data.item ?? null);
  }, [linkedItemId]);

  const handleRefineAndWriteBack = useCallback(async () => {
    if (!linkedItemId || refineLoading) return;
    refineStartedAtRef.current = Date.now();
    setRefineProgressTick(0);
    setRefineLoading(true);
    setRefineError(null);
    try {
      const res = await fetch(
        `/api/knowledge/${encodeURIComponent(linkedItemId)}/refine`,
        { method: "POST" }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        model?: string;
      };
      // eslint-disable-next-line no-console
      console.log("[LearningPage] refine response:", { ok: res.ok, status: res.status, data });
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.model) setLastRefineModel(data.model.replace(/^gemini-/i, "Gemini "));
      setToast("已重新提炼并回写到 Notion");
      window.setTimeout(() => setToast(null), 2600);
      await reloadLinkedDetail();
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : "提炼失败");
    } finally {
      setRefineLoading(false);
    }
  }, [linkedItemId, refineLoading, reloadLinkedDetail]);

  useEffect(() => {
    if (!refineLoading) return;
    const id = window.setInterval(() => setRefineProgressTick((n) => n + 1), 400);
    return () => clearInterval(id);
  }, [refineLoading]);

  const refineProgressUi = useMemo(() => {
    if (!refineLoading || refineStartedAtRef.current <= 0) return null;
    void refineProgressTick;
    const elapsed = Date.now() - refineStartedAtRef.current;
    const pct = Math.min(97, (elapsed / REFINE_CLIENT_ESTIMATE_MS) * 100);
    const secLeft = Math.max(0, Math.ceil((REFINE_CLIENT_ESTIMATE_MS - elapsed) / 1000));
    const elapsedSec = Math.max(0, Math.floor(elapsed / 1000));
    const label =
      elapsed < REFINE_CLIENT_ESTIMATE_MS
        ? `预计还需约 ${secLeft} 秒`
        : "已超出预估时间，仍在处理中…";
    return { pct, label, elapsedSec };
  }, [refineLoading, refineProgressTick]);

  useEffect(() => {
    if (!linkedItemId) {
      setLinkedDetail(null);
      setLinkedDetailLoading(false);
      setLinkedDetailError(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        setLinkedDetailLoading(true);
        setLinkedDetailError(null);
        const res = await fetch(`/api/knowledge/${encodeURIComponent(linkedItemId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { item?: KnowledgeDetail; error?: string };
        // eslint-disable-next-line no-console
        console.log("[LearningPage] /api/knowledge/:id response:", {
          ok: res.ok,
          status: res.status,
          data,
        });
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!active) return;
        setLinkedDetail(data.item ?? null);
      } catch (e) {
        if (!active) return;
        setLinkedDetail(null);
        setLinkedDetailError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (active) setLinkedDetailLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [linkedItemId]);

  const topicTitle =
    linkedDetail?.title || linkedItem?.title || linkedTitle || "Transformer架构深度解析";

  useEffect(() => {
    if (!titleEditMode) {
      setDraftTitle(
        linkedDetail?.title || linkedItem?.title || linkedTitle || "Transformer架构深度解析"
      );
    }
  }, [linkedDetail?.title, linkedItem?.title, linkedTitle, titleEditMode]);

  const saveDocumentTitle = useCallback(async () => {
    const next = draftTitle.trim();
    if (!linkedItemId) return;
    if (!next) {
      setToast("请输入标题");
      return;
    }
    setTitleSaving(true);
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(linkedItemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = (await res.json()) as { error?: string; title?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const saved = String(data.title ?? next);
      setLinkedItem((prev) => (prev ? { ...prev, title: saved } : prev));
      setLinkedDetail((prev) => (prev ? { ...prev, title: saved } : prev));
      setLibraryItems((prev) =>
        prev.map((it) => (it.id === linkedItemId ? { ...it, title: saved } : it))
      );
      router.replace(
        `/learning?itemId=${encodeURIComponent(linkedItemId)}&title=${encodeURIComponent(saved)}`,
        { scroll: false }
      );
      setTitleEditMode(false);
      setToast("标题已保存");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "保存失败");
    } finally {
      setTitleSaving(false);
    }
  }, [draftTitle, linkedItemId, router]);

  const difficulty = linkedItem?.difficulty || "⭐⭐⭐ 高级";

  // 25:00 (番茄钟默认)
  const DEFAULT_SECONDS = 25 * 60;
  const QUICK_SECONDS = 5 * 60;
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [selectedPetId, setSelectedPetId] = useState<PetId>(25);
  const [feedLevel, setFeedLevel] = useState(0);
  const [pokedexLevel, setPokedexLevel] = useState(1);
  const [petEatBurst, setPetEatBurst] = useState(false);

  // Right: Learning modes (特色学习模式)
  const [mode, setMode] = useState<LearningModeKey>("story");
  const [activeMode, setActiveMode] = useState<"feynman" | "interview">("feynman");
  const timeUpTriggeredRef = useRef(false);
  const petEatTimeoutRef = useRef<number | null>(null);
  const sessionKindRef = useRef<"pomodoro25" | "quick5">("pomodoro25");

  // Chat
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nowId(),
      role: "assistant",
      content:
        "今天感觉怎么样？如果觉得累，我们今天就只花 5 分钟复习一个极其简单的概念好吗？哪怕只是随便看看，也是一种胜利。\n\n— 你的 Feynman 导师",
    },
    {
      id: nowId(),
      role: "assistant",
      content:
        "你可以从下面 4 个按钮里随便点一个开始：\n- 费曼解释（像讲给 8 岁小孩）\n- 模拟面试官（准备好战斗了）\n- 随便看看（随机抽 1 个小卡片）\n- 只学 5 分钟（结束自动停）",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  const urgencyLevel = useMemo(() => {
    if (!running) return "idle";
    if (remaining <= 15) return "danger";
    if (remaining <= 60) return "warn";
    return "ok";
  }, [running, remaining]);

  /* =========================
   * Chat helpers
   * ========================= */
  const pushAssistantMessage = useCallback(
    (content: string, actionKey?: ChatActionKey) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nowId(),
          role: "assistant",
          content,
          actionKey,
        },
      ]);
    },
    []
  );

  const awardExp = useCallback((delta: number) => {
    setFeedLevel((prev) => {
      const total = prev + delta;
      const levelUp = Math.floor(total / 100);
      if (levelUp > 0) {
        setPokedexLevel((lv) => lv + levelUp);
      }
      return total % 100;
    });
  }, []);

  const triggerTimeUp = useCallback(() => {
    if (timeUpTriggeredRef.current) return;
    timeUpTriggeredRef.current = true;
    setTimerState("completed");
    awardExp(30);
    // 0.8s “吃零食”反馈：震动 + 闪光
    setPetEatBurst(true);
    if (petEatTimeoutRef.current) window.clearTimeout(petEatTimeoutRef.current);
    petEatTimeoutRef.current = window.setTimeout(() => setPetEatBurst(false), 800);
    const petName = PET_NAMES[selectedPetId];
    pushAssistantMessage(
      `时间到！太棒了，你做得很好。已为${petName}增加 [30 EXP] 零食！`,
      "petReward"
    );
  }, [awardExp, pushAssistantMessage, selectedPetId]);

  function respondByMode(nextMode: LearningModeKey) {
    if (nextMode === "story") {
      pushAssistantMessage(
        "当然！咱们就用 8 岁小孩都能听懂的方式来说。想象你正在参加一个非常嘈杂的派对，虽然周围所有人都在说话，但当有人叫你的名字时，你能瞬间过滤掉其他声音，只听见那个叫你的人。这就是『注意力机制』做的事情！它帮 AI 在海量信息中，瞬间找到最关键的那几个字。听懂了吗？要不要我再换个比喻？"
      );
      return;
    }

    pushAssistantMessage(
      "模拟面试官已就位（准备好战斗了）。\n\n第 1 问：一句话说清楚 Q / K / V 分别是什么；然后再用一句话说清楚它们为什么不能互换。"
    );
  }

  function handleModeSelect(nextMode: LearningModeKey) {
    setMode(nextMode);
    setActiveMode(nextMode === "story" ? "feynman" : "interview");
    respondByMode(nextMode);
  }

  function goOutlineNext() {
    setCurrentStep((s) => (s < 4 ? ((s + 1) as OutlineStep) : s));
  }

  function handleOutlineQuiz(answer: "A" | "B") {
    if (answer === "A") {
      setQuizFeedback("correct");
      setMode("interview");
      pushAssistantMessage(
        "恭喜，回答正确！你已经完成今天的最小闭环。右侧已为您开启面试考核。"
      );
      respondByMode("interview");
      return;
    }
    setQuizFeedback("wrong");
    pushAssistantMessage("这题先别急。小提示：注意力机制的核心价值是缓解长文本依赖遗忘问题。");
  }

  /* =========================
   * Right: Focus Pet selector from reward message
   * ========================= */
  function switchPetPreview(petId: PetId) {
    setSelectedPetId(petId);
    setPokedexLevel((lv) => Math.max(lv, PET_UNLOCK_LEVEL[petId]));
    pushAssistantMessage(`已切换宠物预览：${PET_NAMES[petId]}。`);
  }

  /* =========================
   * Right: Anti-distraction / anti-friction
   * ========================= */
  function handleRandomPeek() {
    setTab("outline");
    const randomStep = (Math.floor(Math.random() * 3) + 1) as OutlineStep;
    setCurrentStep(randomStep);
    const cards = [
      {
        title: "随机小卡：一句话",
        body: "注意力就是：在一堆信息里，挑出此刻最有用的那部分。",
      },
      {
        title: "随机小卡：类比",
        body: "像找书：Query 是你要找的主题，Key 是书脊标签，Value 是书的内容。",
      },
      {
        title: "随机小卡：超小问题",
        body: "你觉得残差连接更像‘保底不丢’还是‘叠加增强’？选一个就行。",
      },
    ];
    const pick = cards[Math.floor(Math.random() * cards.length)];
    pushAssistantMessage(
      `只想随便看看，完全可以。\n\n${pick.title}\n${pick.body}\n\n你现在只要回一句“我懂/我不懂”，就算完成。`
    );
  }

  function handleStartQuick5() {
    timeUpTriggeredRef.current = false;
    sessionKindRef.current = "quick5";
    setRemaining(QUICK_SECONDS);
    setRunning(true);
    setTimerState("focusing");
    pushAssistantMessage(
      "没问题，我们今天就只花5分钟。我已经随机为你抽取了一张知识卡片，准备好我们就开始计时！"
    );
    handleRandomPeek();
  }

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Stop when timer finishes (handled inside interval callback to satisfy
          // react-hooks/set-state-in-effect lint rule).
          triggerTimeUp();
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, triggerTimeUp]);

  useEffect(() => {
    // Cleanup: clear “pet eat” animation timeout on unmount.
    return () => {
      if (petEatTimeoutRef.current) {
        window.clearTimeout(petEatTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // 自动滚动到最新消息
    const el = chatScrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // 切换学习方式时，确保对话区跳到最底端（避免“停在中间”）。
    if (activeMode !== "feynman") return;
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeMode]);

  function toggleTimer() {
    if (remaining === 0) {
      timeUpTriggeredRef.current = false;
      sessionKindRef.current = "pomodoro25";
      setRemaining(DEFAULT_SECONDS);
      setRunning(true);
      setTimerState("focusing");
      return;
    }
    setRunning((v) => {
      const next = !v;
      setTimerState(next ? "focusing" : "idle");
      return next;
    });
  }

  function resetTimer() {
    timeUpTriggeredRef.current = false;
    sessionKindRef.current = "pomodoro25";
    setRunning(false);
    setRemaining(DEFAULT_SECONDS);
    setTimerState("idle");
  }

  const rawTextSource = String(sessionRawText || linkedDetail?.rawText || "").replace(
    /\\n/g,
    "\n"
  );

  // Word 风格的“定位到具体位置”：高亮所有匹配点 + 支持上一处/下一处跳转。
  const [rawMatchIndex, setRawMatchIndex] = useState(0);
  const rawMatchElsRef = useRef<Record<string, HTMLSpanElement | null>>({});

  const rawMatchOccurrences = useMemo(() => {
    const q = rawFilterQuery.trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    const lines = String(rawTextSource || "").split("\n");
    const qLen = q.length;

    const out: Array<{ key: string; lineIndex: number; start: number; end: number }> = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex] ?? "";
      const lineLower = line.toLowerCase();
      let startFrom = 0;
      while (true) {
        const found = lineLower.indexOf(qLower, startFrom);
        if (found === -1) break;
        const start = found;
        const end = found + qLen;
        const key = `${lineIndex}:${start}:${end}`;
        out.push({ key, lineIndex, start, end });
        startFrom = found + 1; // 允许重叠匹配（更像“查找”）
      }
    }
    return out;
  }, [rawTextSource, rawFilterQuery]);

  const rawMatchCount = rawMatchOccurrences.length;
  const rawActiveMatchKey = rawMatchOccurrences[rawMatchIndex]?.key ?? null;

  useEffect(() => {
    // 每次输入/切换文章，重置到第一处匹配
    setRawMatchIndex(0);
    rawMatchElsRef.current = {};
  }, [rawFilterQuery, rawTextSource]);

  useEffect(() => {
    if (!rawActiveMatchKey) return;
    const el = rawMatchElsRef.current[rawActiveMatchKey];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [rawActiveMatchKey]);

  const goRawPrevMatch = useCallback(() => {
    if (!rawMatchCount) return;
    setRawMatchIndex((i) => (i - 1 + rawMatchCount) % rawMatchCount);
  }, [rawMatchCount]);

  const goRawNextMatch = useCallback(() => {
    if (!rawMatchCount) return;
    setRawMatchIndex((i) => (i + 1) % rawMatchCount);
  }, [rawMatchCount]);

  const rawTextHighlighted = useMemo(() => {
    const q = rawFilterQuery.trim();
    if (!q) return rawTextSource;
    const qLower = q.toLowerCase();
    const lines = String(rawTextSource || "").split("\n");
    const qLen = q.length;
    const activeKey = rawActiveMatchKey;

    const out: ReactNode[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex] ?? "";
      const lineLower = line.toLowerCase();
      let pos = 0;

      while (true) {
        const found = lineLower.indexOf(qLower, pos);
        if (found === -1) break;
        const start = found;
        const end = found + qLen;
        const key = `${lineIndex}:${start}:${end}`;

        if (start > pos) out.push(line.slice(pos, start));

        out.push(
          <mark
            key={`m-${key}`}
            ref={(el) => {
              rawMatchElsRef.current[key] = el;
            }}
            className={
              key === activeKey
                ? "rounded-sm bg-yellow-300/50 px-[1px] text-slate-50"
                : "rounded-sm bg-yellow-200/25 px-[1px] text-slate-50"
            }
          >
            {line.slice(start, end)}
          </mark>
        );

        pos = end;
      }

      if (pos < line.length) out.push(line.slice(pos));

      if (lineIndex !== lines.length - 1) out.push("\n");
    }

    return out;
  }, [rawFilterQuery, rawTextSource, rawActiveMatchKey]);

  /** 无关键词筛选时：资料原文按 Markdown 渲染（与大纲 Tab 一致的基础样式） */
  const rawMarkdownComponents = useMemo(
    () => ({
      code({
        className,
        children,
        ...props
      }: {
        className?: string;
        children?: ReactNode;
      }) {
        const m = /language-(\w+)/.exec(className || "");
        const lang = m?.[1] || "";
        const raw = String(children ?? "");
        if (lang === "mermaid") {
          return <MermaidBlock code={raw} />;
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    []
  );

  // =================
  // Outline search
  // =================
  const outlineFullMarkdown = useMemo(() => {
    return String(sessionAiSummary || linkedDetail?.outlineMarkdown || "")
      .replace(/\\n/g, "\n")
      .trim();
  }, [sessionAiSummary, linkedDetail?.outlineMarkdown]);

  const outlineMermaidCode = useMemo(() => {
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/m;
    const m = outlineFullMarkdown.match(mermaidRegex);
    return m?.[1]?.trim() ? String(m[1]).trim() : null;
  }, [outlineFullMarkdown]);

  const outlineTextSource = useMemo(() => {
    // 仅保留纯文字大纲部分（剔除 mermaid 代码块）
    return outlineFullMarkdown.replace(/```mermaid[\s\S]*?```/m, "").trim();
  }, [outlineFullMarkdown]);

  // 让思维导图 Tab 也能在不触发 uploadOpen 的情况下正常渲染
  useEffect(() => {
    if (tab !== "diagram") return;
    if (!outlineMermaidCode) return;
    if (mermaidInitedRef.current) return;
    mermaidInitedRef.current = true;
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
        flowchart: { curve: "basis" },
      });
    } catch {}
  }, [tab, outlineMermaidCode]);

  useEffect(() => {
    setOutlineMatchIndex(0);
    outlineMatchElsRef.current = {};
  }, [outlineFilterQuery, outlineTextSource]);

  useLayoutEffect(() => {
    if (tab !== "outline") {
      setOutlineHitCount(0);
      return;
    }
    const q = outlineFilterQuery.trim();
    if (!q) {
      setOutlineHitCount(0);
      return;
    }
    const root = outlineMarkdownMountRef.current;
    if (!root) {
      setOutlineHitCount(0);
      return;
    }
    setOutlineHitCount(root.querySelectorAll("[data-outline-hit]").length);
  }, [tab, outlineFilterQuery, outlineTextSource, sessionAiSummary, linkedDetail?.outlineMarkdown]);

  useEffect(() => {
    if (outlineHitCount === 0) return;
    setOutlineMatchIndex((i) => (i >= outlineHitCount ? 0 : i));
  }, [outlineHitCount]);

  useEffect(() => {
    if (!outlineFilterQuery.trim()) return;
    const el = outlineMatchElsRef.current[outlineMatchIndex];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [outlineMatchIndex, outlineFilterQuery, outlineHitCount]);

  const goOutlinePrevMatch = useCallback(() => {
    if (!outlineHitCount) return;
    setOutlineMatchIndex((i) => (i - 1 + outlineHitCount) % outlineHitCount);
  }, [outlineHitCount]);

  const goOutlineNextMatch = useCallback(() => {
    if (!outlineHitCount) return;
    setOutlineMatchIndex((i) => (i + 1) % outlineHitCount);
  }, [outlineHitCount]);

  const outlineRehypePlugins = useMemo(() => {
    return outlineFilterQuery.trim() ? [rehypeWrapOutlineSearchShell] : [];
  }, [outlineFilterQuery]);

  const outlineMarkdownComponents = useMemo(() => {
    const qTrim = outlineFilterQuery.trim();
    const activeIdx = outlineMatchIndex;
    const ordBox = { n: 0 };

    function OutlineMdDiv(
      props: React.ComponentProps<"div"> & { node?: unknown }
    ) {
      const { className, children, ...rest } = props;
      const tokens = classNameTokens(className);
      const isShell = tokens.includes("md-outline-search-shell");
      if (isShell && qTrim) {
        ordBox.n = 0;
        const cls = tokens.filter((t) => t !== "md-outline-search-shell").join(" ") || undefined;
        return (
          <div {...rest} className={cls}>
            {wrapOutlineMarkdownChildren(children, qTrim, ordBox, activeIdx, outlineMatchElsRef)}
          </div>
        );
      }
      return (
        <div className={className} {...rest}>
          {children}
        </div>
      );
    }

    return {
      div: OutlineMdDiv,
      code({ className, children, ...props }: { className?: string; children?: ReactNode }) {
        const m = /language-(\w+)/.exec(className || "");
        const lang = m?.[1] || "";
        const raw = String(children ?? "");
        if (lang === "mermaid") {
          return <MermaidBlock code={raw} />;
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    };
  }, [outlineFilterQuery, outlineMatchIndex]);

  // ==============
  // Raw annotations
  // ==============
  const rawAnnotStorageKey = useMemo(() => {
    const key = linkedItemId ? String(linkedItemId) : "session";
    return `raw-annot-${key}`;
  }, [linkedItemId]);

  const outlineAnnotStorageKey = useMemo(() => {
    const key = linkedItemId ? String(linkedItemId) : "session";
    return `outline-annot-${key}`;
  }, [linkedItemId]);

  function getRawAnnotCanvasCtx(): CanvasRenderingContext2D | null {
    const canvas = rawAnnotCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return ctx;
  }

  const resizeRawAnnotCanvas = useCallback(() => {
    const wrap = rawAnnotWrapRef.current;
    const canvas = rawAnnotCanvasRef.current;
    const ctx = getRawAnnotCanvasCtx();
    if (!wrap || !canvas || !ctx) return;

    // Use client sizes to avoid first-layout glitches that can happen with boundingClientRect.
    let w = wrap.clientWidth;
    let h = wrap.clientHeight;
    if (!w || !h) {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
    }
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Preserve existing drawing as image.
    const prevDataUrl = rawAnnotImageDataUrlRef.current;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Reset transform so drawing uses CSS pixel coordinates.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (prevDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = prevDataUrl;
    }
  }, []);

  const loadRawAnnotations = useCallback(() => {
    const wrap = rawAnnotWrapRef.current;
    if (!wrap) return;
    const stored = window.localStorage.getItem(rawAnnotStorageKey);
    rawAnnotImageDataUrlRef.current = stored;
    // Resize first, then draw from stored (resize function draws prevDataUrl).
    resizeRawAnnotCanvas();
  }, [rawAnnotStorageKey, resizeRawAnnotCanvas]);

  const clearRawAnnotations = useCallback(() => {
    rawAnnotImageDataUrlRef.current = null;
    window.localStorage.removeItem(rawAnnotStorageKey);
    const wrap = rawAnnotWrapRef.current;
    const canvas = rawAnnotCanvasRef.current;
    const ctx = getRawAnnotCanvasCtx();
    if (!wrap || !canvas || !ctx) return;
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    ctx.clearRect(0, 0, w, h);
  }, [rawAnnotStorageKey]);

  function getOutlineAnnotCanvasCtx(): CanvasRenderingContext2D | null {
    const canvas = outlineAnnotCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return ctx;
  }

  const resizeOutlineAnnotCanvas = useCallback(() => {
    const wrap = outlineAnnotWrapRef.current;
    const canvas = outlineAnnotCanvasRef.current;
    const ctx = getOutlineAnnotCanvasCtx();
    if (!wrap || !canvas || !ctx) return;

    let w = wrap.clientWidth;
    let h = wrap.clientHeight;
    if (!w || !h) {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
    }
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const prevDataUrl = outlineAnnotImageDataUrlRef.current;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (prevDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = prevDataUrl;
    }
  }, []);

  const loadOutlineAnnotations = useCallback(() => {
    const wrap = outlineAnnotWrapRef.current;
    if (!wrap) return;
    const stored = window.localStorage.getItem(outlineAnnotStorageKey);
    outlineAnnotImageDataUrlRef.current = stored;
    resizeOutlineAnnotCanvas();
  }, [outlineAnnotStorageKey, resizeOutlineAnnotCanvas]);

  const clearOutlineAnnotations = useCallback(() => {
    outlineAnnotImageDataUrlRef.current = null;
    window.localStorage.removeItem(outlineAnnotStorageKey);
    const wrap = outlineAnnotWrapRef.current;
    const canvas = outlineAnnotCanvasRef.current;
    const ctx = getOutlineAnnotCanvasCtx();
    if (!wrap || !canvas || !ctx) return;
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    ctx.clearRect(0, 0, w, h);
  }, [outlineAnnotStorageKey]);

  useEffect(() => {
    if (tab !== "raw") return;
    loadRawAnnotations();
  }, [tab, loadRawAnnotations]);

  useEffect(() => {
    if (tab !== "outline") return;
    loadOutlineAnnotations();
  }, [tab, loadOutlineAnnotations]);

  // 为了保证用户能在“整个原文区域”标注：开启画笔时强制展开原文。
  useEffect(() => {
    if (tab !== "raw") return;
    if (!rawAnnotEnabled) return;
    if (!rawCollapsed) return;
    setRawCollapsed(false);
  }, [tab, rawAnnotEnabled, rawCollapsed]);

  // 当画笔开启/折叠切换时，确保 canvas 尺寸与布局同步（避免只覆盖左上角）。
  useEffect(() => {
    if (tab !== "raw") return;
    if (!rawAnnotEnabled) return;
    // 交给下一帧，让 DOM 完成重新布局
    window.requestAnimationFrame(() => resizeRawAnnotCanvas());
  }, [tab, rawAnnotEnabled, rawCollapsed, resizeRawAnnotCanvas]);

  useEffect(() => {
    if (tab !== "outline") return;
    if (!outlineAnnotEnabled) return;
    window.requestAnimationFrame(() => resizeOutlineAnnotCanvas());
  }, [
    tab,
    outlineAnnotEnabled,
    outlineTextSource,
    outlineFilterQuery,
    resizeOutlineAnnotCanvas,
  ]);

  // 筛选开启时禁用画笔并清空标注，避免“筛选后行位置变化导致标注错位”
  useEffect(() => {
    if (tab !== "raw") return;
    const q = rawFilterQuery.trim();
    if (!q) return;
    // 查找模式下应展示全文以便跳转到具体位置
    if (rawCollapsed) setRawCollapsed(false);
    if (rawAnnotEnabled) setRawAnnotEnabled(false);
  }, [tab, rawFilterQuery, rawAnnotEnabled, rawCollapsed]);

  useEffect(() => {
    if (tab !== "outline") return;
    const q = outlineFilterQuery.trim();
    if (!q) return;
    if (outlineAnnotEnabled) setOutlineAnnotEnabled(false);
  }, [tab, outlineFilterQuery, outlineAnnotEnabled]);

  useEffect(() => {
    const wrap = rawAnnotWrapRef.current;
    if (!wrap) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      resizeRawAnnotCanvas();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [resizeRawAnnotCanvas]);

  useEffect(() => {
    const wrap = outlineAnnotWrapRef.current;
    if (!wrap) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      resizeOutlineAnnotCanvas();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [resizeOutlineAnnotCanvas]);

  const canDrawRaw = tab === "raw" && rawAnnotEnabled && !rawCollapsed && rawFilterQuery.trim() === "";
  const canDrawOutline =
    tab === "outline" && outlineAnnotEnabled && outlineFilterQuery.trim() === "";

  function getRawCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const wrap = rawAnnotWrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startRawDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDrawRaw) return;
    // Prevent scrolling/selection glitches while drawing.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const ctx = getRawAnnotCanvasCtx();
    if (!ctx) return;

    rawAnnotIsDrawingRef.current = true;
    rawAnnotLastPointRef.current = getRawCanvasPoint(e.nativeEvent);

    const { x, y } = rawAnnotLastPointRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (rawAnnotTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = rawAnnotSize;
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }

    ctx.globalCompositeOperation = "source-over";
    // 高亮模式：更“透明的荧光笔”，尽量不遮挡文字阅读
    const color =
      rawAnnotTool === "highlighter" ? "rgba(251, 191, 36, 0.05)" : "#ef4444";
    ctx.strokeStyle = color;
    ctx.lineWidth = rawAnnotTool === "highlighter" ? rawAnnotSize + 4 : rawAnnotSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveRawDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDrawRaw) return;
    if (!rawAnnotIsDrawingRef.current) return;
    const ctx = getRawAnnotCanvasCtx();
    if (!ctx) return;
    const last = rawAnnotLastPointRef.current;
    if (!last) return;

    const next = getRawCanvasPoint(e.nativeEvent);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    rawAnnotLastPointRef.current = next;
  }

  function endRawDrawing() {
    if (!rawAnnotIsDrawingRef.current) return;
    rawAnnotIsDrawingRef.current = false;
    rawAnnotLastPointRef.current = null;

    const canvas = rawAnnotCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      rawAnnotImageDataUrlRef.current = dataUrl;
      window.localStorage.setItem(rawAnnotStorageKey, dataUrl);
    } catch {
      /* ignore data url errors */
    }
  }

  function getOutlineCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const wrap = outlineAnnotWrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const rect = wrap.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startOutlineDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDrawOutline) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const ctx = getOutlineAnnotCanvasCtx();
    if (!ctx) return;

    outlineAnnotIsDrawingRef.current = true;
    outlineAnnotLastPointRef.current = getOutlineCanvasPoint(e.nativeEvent);

    const { x, y } = outlineAnnotLastPointRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (outlineAnnotTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = outlineAnnotSize;
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }

    ctx.globalCompositeOperation = "source-over";
    const color =
      outlineAnnotTool === "highlighter" ? "rgba(251, 191, 36, 0.05)" : "#ef4444";
    ctx.strokeStyle = color;
    ctx.lineWidth = outlineAnnotTool === "highlighter" ? outlineAnnotSize + 4 : outlineAnnotSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveOutlineDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDrawOutline) return;
    if (!outlineAnnotIsDrawingRef.current) return;
    const ctx = getOutlineAnnotCanvasCtx();
    if (!ctx) return;
    const last = outlineAnnotLastPointRef.current;
    if (!last) return;

    const next = getOutlineCanvasPoint(e.nativeEvent);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    outlineAnnotLastPointRef.current = next;
  }

  function endOutlineDrawing() {
    if (!outlineAnnotIsDrawingRef.current) return;
    outlineAnnotIsDrawingRef.current = false;
    outlineAnnotLastPointRef.current = null;

    const canvas = outlineAnnotCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      outlineAnnotImageDataUrlRef.current = dataUrl;
      window.localStorage.setItem(outlineAnnotStorageKey, dataUrl);
    } catch {
      /* ignore */
    }
  }

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: nowId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Demo AI reply (placeholder) — depends on selected learning mode.
    window.setTimeout(() => {
      if (mode === "story") {
        pushAssistantMessage(
          "收到。\n\n我先把你的复述压缩成一段“故事版本”（占位）：\n- 你从 Query 出发\n- 你在 Key 里找证据\n- 你用残差把新信息保住\n\n然后我会问你一个追问：把这个因果链用一句类比说出来，你会用什么？"
        );
      } else {
        pushAssistantMessage(
          "收到。\n\n我记录你的答案。进入追问：当软连接注意力权重上升时，残差路径会更像“强调”还是“修正”？请给出你的一步推导（占位）。"
        );
      }
    }, 500);
  }

  /* =========================
   * Left: NotebookLM mode start
   * ========================= */
  function parseIngestErrorBody(text: string): string {
    const t = text.trim();
    if (!t) return "";
    try {
      const j = JSON.parse(t) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      /* 非 JSON 时沿用原文 */
    }
    return t;
  }

  /** 已展示 Toast / 状态后抛出，供上层 catch，避免关闭弹窗与红屏 */
  function throwIngestUserError(message: string): never {
    const e = new Error(message);
    e.name = "IngestUserError";
    throw e;
  }

  async function handleNotebookLMStart(payload: {
    files: File[];
    pastedText: string;
    modelId: string;
    sourceUrl: string;
    materialType: string;
  }) {
    const fileCount = payload.files.length;
    const pastedText = payload.pastedText.trim();
    const firstNames = payload.files.slice(0, 3).map((f) => f.name);
    const fileText = fileCount
      ? `已接入 ${fileCount} 份资料（${firstNames.join("、")}${fileCount > 3 ? " 等" : ""}）。`
      : pastedText
        ? "未上传文件，将仅基于外部 AI 总结文本做初步整理（占位）。"
        : "未检测到文件内容。";

    pushAssistantMessage(`NotebookLM 模式：资料整理开始。\n\n${fileText}\n\nAI 正在阅读并整理中…`);

    // When library is updated, default back to outline for a more “system” feel.
    setTab("outline");
    setCurrentStep(1);
    setSelectedConcept(null);
    setQuizFeedback("none");

    try {
      ingestAbortRef.current?.abort();
    } catch {}
    const abort = new AbortController();
    ingestAbortRef.current = abort;

    setIngestStreaming(true);
    ingestBufferRef.current = "";
    ingestTypedLenRef.current = 0;
    setIngestBufferLen(0);
    setIngestTypedText("");
    setIngestStreamError(null);
    setDeepProgressLabel(null);
    setSessionRawText("");
    setSessionAiSummary("");
    sessionRawTextRef.current = "";
    sessionAiSummaryRef.current = "";

    const selectedModelId = payload.modelId || "gemini-2.5-flash";
    const firstFile = payload.files.length === 1 ? payload.files[0]! : null;
    let pdfTotalPages = 0;
    if (firstFile && isPdfFileClient(firstFile)) {
      try {
        const buf = await firstFile.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        pdfTotalPages = doc.getPageCount();
      } catch {
        pdfTotalPages = 0;
      }
    }
    const VISION_PAGE_MAX = 3;
    if (firstFile && isPdfFileClient(firstFile) && pdfTotalPages > VISION_PAGE_MAX) {
      setDeepProgressLabel(
        `⚡ 检测到文档 (共 ${pdfTotalPages} 页)，已自动切换至极速纯文本引擎（仅 ≤${VISION_PAGE_MAX} 页启用视觉解析）...`
      );
    } else if (firstFile && isPdfFileClient(firstFile) && pdfTotalPages > 0) {
      setDeepProgressLabel(
        `🔍 极短 PDF (共 ${pdfTotalPages} 页)，已启动深度视觉引擎，正在像素级解析图表与版式...`
      );
    }
    const RETRY_MAX = 3;
    const shouldRetryStatus = (status: number) => status === 503 || status === 429;

    function appendSystemHint(line: string) {
      const msg = `\n\n⚠️ ${line}\n`;
      const next = (ingestBufferRef.current || "") + msg;
      ingestBufferRef.current = next;
      setIngestBufferLen(next.length);
    }

    async function sleepOrAbort(ms: number) {
      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((r) => setTimeout(r, ms));
      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");
    }

    async function readIngestSseStream(
      res: Response,
      baseAiPrefix: string
    ): Promise<{ pageId: string; ingestTitle: string; streamError: string }> {
      if (!res.body) {
        return { pageId: "", ingestTitle: "", streamError: "服务器未返回可读取的流（response.body 为空）。" };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      let pageId = "";
      let ingestTitle = "";
      let streamError = "";

      const pushAi = (delta: string) => {
        const next = (baseAiPrefix || "") + (sessionAiSummaryRef.current || "") + delta;
        sessionAiSummaryRef.current = next.replace(/\\n/g, "\n");
        setSessionAiSummary(sessionAiSummaryRef.current);
        ingestBufferRef.current = sessionAiSummaryRef.current;
        setIngestBufferLen(ingestBufferRef.current.length);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = frame.split("\n");
          const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim() || "";
          const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim() || "";
          if (!ev || !dataLine) continue;
          let parsed: IngestSseEvent | null = null;
          try {
            parsed = { event: ev as never, data: JSON.parse(dataLine) as never } as IngestSseEvent;
          } catch {
            parsed = null;
          }
          if (!parsed) continue;
          if (parsed.event === "rawTextChunk") {
            sessionRawTextRef.current += parsed.data.text;
            setSessionRawText(sessionRawTextRef.current);
          } else if (parsed.event === "aiDelta") {
            pushAi(parsed.data.delta);
          } else if (parsed.event === "aiFull") {
            const text = String(parsed.data.text || "").replace(/\\n/g, "\n");
            sessionAiSummaryRef.current = (baseAiPrefix || "") + text;
            setSessionAiSummary(sessionAiSummaryRef.current);
            ingestBufferRef.current = sessionAiSummaryRef.current;
            setIngestBufferLen(ingestBufferRef.current.length);
          } else if (parsed.event === "traceWarn") {
            const msg = String(parsed.data.message || "").trim();
            if (msg) appendSystemHint(msg);
          } else if (parsed.event === "done") {
            pageId = parsed.data.pageId || "";
            ingestTitle = String(parsed.data.title ?? "").trim();
          } else if (parsed.event === "error") {
            streamError = parsed.data.message || "Unknown error";
          }
        }
      }
      return { pageId, ingestTitle, streamError };
    }

    async function postIngestWithRetry(fd: FormData): Promise<Response> {
      let lastStatus = 0;
      for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
        const res = await fetch("/api/knowledge/ingest", {
          method: "POST",
          body: fd,
          signal: abort.signal,
        });

        if (res.ok) {
          if (!res.body) {
            const msg = "服务器未返回可读取的流（response.body 为空）。";
            setIngestStreamError(msg);
            pushAssistantMessage(`整理失败：${msg}`);
            setToast(msg);
            window.setTimeout(() => setToast(null), 4200);
            setIngestStreaming(false);
            ingestAbortRef.current = null;
            setDeepProgressLabel(null);
            throwIngestUserError(msg);
          }
          return res;
        }

        lastStatus = res.status;
        if (shouldRetryStatus(res.status) && attempt < RETRY_MAX) {
          const waitMs =
            res.status === 429
              ? 15000 * Math.pow(2, attempt - 1) // 15s / 30s
              : 3000 * Math.pow(2, attempt - 1); // 3s / 6s
          appendSystemHint(
            `Google 服务器当前繁忙，正在为您自动重试当前片段 (${attempt}/${RETRY_MAX})...（等待 ${Math.round(
              waitMs / 1000
            )} 秒）`
          );
          // 尽快释放连接
          try {
            await res.body?.cancel();
          } catch {}
          // eslint-disable-next-line no-await-in-loop
          await sleepOrAbort(waitMs);
          continue;
        }

        // 非可重试错误：沿用原有错误解析与 UI 反馈
        let raw = "";
        try {
          raw = await res.text();
        } catch {
          raw = "";
        }
        const parsed = parseIngestErrorBody(raw);
        const msg =
          parsed ||
          (res.status === 429
            ? "AI 思考过于频繁或文档过长导致额度超限，请稍后再试。"
            : `请求失败（HTTP ${res.status}）`);
        setIngestStreamError(msg);
        pushAssistantMessage(`整理失败：${msg}`);
        setToast(msg);
        window.setTimeout(() => setToast(null), 4200);
        setIngestStreaming(false);
        ingestAbortRef.current = null;
        setDeepProgressLabel(null);
        throwIngestUserError(msg);
      }

      const msg = `请求失败（HTTP ${lastStatus || "unknown"}）`;
      setIngestStreamError(msg);
      pushAssistantMessage(`整理失败：${msg}`);
      setToast(msg);
      window.setTimeout(() => setToast(null), 4200);
      setIngestStreaming(false);
      ingestAbortRef.current = null;
      setDeepProgressLabel(null);
      throwIngestUserError(msg);
    }

    let pageId = "";

    try {
      const fd = new FormData();
      payload.files.forEach((f) => fd.append("files", f));
      if (pastedText) fd.append("pastedText", pastedText);
      const src = (payload.sourceUrl || "").trim();
      if (src) fd.append("sourceUrl", src);
      const mt = (payload.materialType || "").trim() || "未分类";
      fd.append("materialType", mt);
      fd.append("modelId", selectedModelId);
      // 兼容字段：后端同时支持 model / modelId
      fd.append("model", selectedModelId);

      const res = await postIngestWithRetry(fd);
      const { pageId: pid, ingestTitle, streamError } = await readIngestSseStream(res, "");

      if (streamError) {
        setIngestStreamError(streamError);
        pushAssistantMessage(`整理失败：${streamError}`);
        setToast(streamError);
        window.setTimeout(() => setToast(null), 4200);
        setIngestStreaming(false);
        ingestAbortRef.current = null;
        setDeepProgressLabel(null);
        throwIngestUserError(streamError);
      }

      pageId = pid;
      setDeepProgressLabel(null);

      setIngestStreaming(false);
      ingestAbortRef.current = null;

      const catchUpDeadline = Date.now() + 120_000;
      while (
        ingestTypedLenRef.current < ingestBufferRef.current.length &&
        Date.now() < catchUpDeadline
      ) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 40));
      }

      // ingest 返回的是 text/plain 流，绝不能对整段响应做 JSON.parse
      let listRefreshOk = false;
      try {
        setLibraryLoading(true);
        setLibraryError(null);
        const r2 = await fetch("/api/knowledge", { cache: "no-store" });
        const rawList = await r2.text();
        if (!r2.ok) {
          let errMsg = `HTTP ${r2.status}`;
          if (rawList.trim()) {
            try {
              const j = JSON.parse(rawList) as { error?: string };
              if (typeof j.error === "string" && j.error.trim()) errMsg = j.error.trim();
              else errMsg = rawList.slice(0, 240);
            } catch {
              errMsg = rawList.slice(0, 240);
            }
          }
          setLibraryError(errMsg);
          listRefreshOk = false;
        } else if (!rawList.trim()) {
          setLibraryItems([]);
          listRefreshOk = true;
        } else {
          try {
            const d2 = JSON.parse(rawList) as { items?: KnowledgeItem[]; error?: string };
            if (Array.isArray(d2.items)) {
              setLibraryItems(
                d2.items.map((it) => ({
                  ...it,
                  keywords: Array.isArray(it.keywords) ? it.keywords : [],
                }))
              );
              listRefreshOk = true;
            } else {
              setLibraryError("资料列表格式异常");
              listRefreshOk = false;
            }
          } catch {
            setLibraryError("资料列表刷新失败（响应不是合法 JSON）");
            listRefreshOk = false;
          }
        }
      } finally {
        setLibraryLoading(false);
      }

      if (listRefreshOk) {
        setToast("收录成功");
        window.setTimeout(() => setToast(null), 2600);
      } else {
        setToast("已写入 Notion，但列表刷新失败");
        pushAssistantMessage(
          "资料已写入 Notion，但左侧「全部资料」列表未能自动刷新。请稍后手动刷新页面，或从 Learning Dashboard 进入查看。"
        );
        window.setTimeout(() => setToast(null), 4200);
      }

      if (pageId) {
        const nextTitle =
          ingestTitle ||
          firstNames[0]?.replace(/\.[^.]+$/, "") ||
          (pastedText.trim() ? "视频文稿" : "新资料");
        router.push(`/learning?itemId=${encodeURIComponent(pageId)}&title=${encodeURIComponent(nextTitle)}`);
      }

      respondByMode(mode);
    } catch (e) {
      if (e instanceof Error && e.name === "IngestUserError") {
        throw e;
      }
      if (e instanceof DOMException && e.name === "AbortError") {
        setIngestStreaming(false);
        ingestAbortRef.current = null;
        setDeepProgressLabel(null);
        return;
      }
      const msg = e instanceof Error ? e.message : "整理失败";
      setIngestStreamError(msg);
      pushAssistantMessage(`整理失败：${msg}`);
      setToast(msg);
      window.setTimeout(() => setToast(null), 4200);
      setIngestStreaming(false);
      ingestAbortRef.current = null;
      setDeepProgressLabel(null);
      throwIngestUserError(msg);
    }
  }

  const recommendedVideos = useMemo(() => {
    const rawText = linkedDetail?.rawText ?? "";
    const fromSourceLine = extractMaterialSourceUrlFromRawText(rawText);
    const links = linkedDetail?.videoLinks ?? [];
    const keywords = linkedDetail?.coreKeywords ?? [];
    const pinned =
      fromSourceLine && isVideoWatchUrl(fromSourceLine)
        ? fromSourceLine
        : links.find((u) => isVideoWatchUrl(u));
    const out: Array<{ id: string; url: string; title: string; source: VideoRecSource }> = [];
    const seen = new Set<string>();

    if (pinned) {
      out.push({
        id: `pin-${pinned}`,
        url: pinned,
        title: shortVideoLabel(pinned),
        source: guessVideoSource(pinned),
      });
      seen.add(pinned);
    }

    if (keywords.length) {
      for (let idx = 0; idx < keywords.length && out.length < 6; idx++) {
        const kw = keywords[idx]!;
        const useBili = idx % 2 === 0;
        const url = useBili ? buildBilibiliSearchUrl(kw) : buildYouTubeSearchUrl(kw);
        if (seen.has(url)) continue;
        seen.add(url);
        const source: VideoRecSource = useBili ? "B站" : "YouTube";
        out.push({ id: `kw-${idx}-${kw}`, url, title: kw, source });
      }
      return out;
    }

    for (const url of links) {
      if (out.length >= 6) break;
      if (seen.has(url)) continue;
      if (!/^https?:\/\//i.test(url)) continue;
      seen.add(url);
      out.push({
        id: `v-${url}`,
        url,
        title: shortVideoLabel(url),
        source: guessVideoSource(url),
      });
    }
    return out;
  }, [linkedDetail?.rawText, linkedDetail?.coreKeywords, linkedDetail?.videoLinks]);

  const timerTextClass =
    urgencyLevel === "danger"
      ? "text-red-300 animate-[pulse_1.1s_ease-in-out_infinite]"
      : urgencyLevel === "warn"
        ? "text-amber-200 animate-[pulse_1.35s_ease-in-out_infinite]"
        : "text-cyan-200";

  const subtleBreath =
    urgencyLevel === "danger" || urgencyLevel === "warn"
      ? "ring-1 ring-red-500/30 shadow-[0_0_0_1px_rgba(248,113,113,0.25),0_0_30px_rgba(248,113,113,0.12)]"
      : "ring-1 ring-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_0_28px_rgba(34,211,238,0.07)]";

  return (
    <div className="h-screen overflow-hidden bg-neutral-950 text-slate-100">
      {isMapOpen && mermaidCode ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
          <div className="relative flex h-[80vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/70 shadow-[0_30px_120px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur">
            <TransformWrapper
              minScale={0.05}
              maxScale={6}
              initialScale={1}
              centerOnInit
              wheel={{ step: 0.12 }}
              pinch={{ step: 8 }}
              panning={{ velocityDisabled: true }}
              onInit={(api) => {
                fitMindmapZoomToView(api, () => globalMapShellRef.current);
              }}
            >
              {(controls) => (
                <>
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">全局知识图谱</div>
                      <div className="mt-1 text-xs text-slate-400">
                        滚轮缩放 · 拖拽平移 · Esc 关闭
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MermaidMindmapZoomToolbar
                        controls={controls}
                        className="flex flex-wrap items-center gap-1.5"
                        onFitView={() =>
                          fitMindmapZoomToView(controls, () => globalMapShellRef.current)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(false)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"
                        aria-label="Close mind map (Esc)"
                      >
                        关闭 <span className="font-mono text-slate-400">(Esc)</span>
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden p-4">
                    <TransformComponent
                      wrapperClass="h-full w-full"
                      contentClass="h-full w-full"
                    >
                      <div
                        ref={globalMapShellRef}
                        className="flex h-full min-h-[50vh] w-full items-center justify-center"
                      >
                        <MermaidViewer code={mermaidCode} />
                      </div>
                    </TransformComponent>
                  </div>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      ) : null}
      {diagramMindmapFullscreen && outlineMermaidCode ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-neutral-900/60 px-4 py-3">
            <span className="text-sm font-medium text-slate-200">全屏查看思维导图</span>
            <button
              type="button"
              onClick={() => setDiagramMindmapFullscreen(false)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="关闭全屏"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
            <MermaidBlock
              code={outlineMermaidCode}
              zoomable
              zoomLayout="fullscreen"
              className="!m-0 h-full min-h-0 !rounded-xl border border-white/10 !bg-black/30 sm:!border"
            />
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed right-4 top-4 z-[80]">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-xl backdrop-blur">
            {toast}
          </div>
        </div>
      ) : null}
      <style jsx global>{`
        /* Hide the main scrollbar; keep inner sections scrollable. */
        .scrollbar-hidden::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }

        /* PokeFocusPet: 0.8s “吃零食”震动 + 闪光反馈 */
        @keyframes pokePetEatBurst {
          0% {
            transform: translate(0, 0) scale(1);
            box-shadow: none;
            filter: brightness(1);
          }
          20% {
            transform: translate(-3px, 1px) scale(1.06) rotate(-1deg);
            box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.35), 0 0 35px rgba(34, 211, 238, 0.3);
            filter: brightness(1.35);
          }
          55% {
            transform: translate(3px, -1px) scale(1.03) rotate(1.5deg);
            box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.35), 0 0 45px rgba(168, 85, 247, 0.25);
            filter: brightness(1.25);
          }
          100% {
            transform: translate(0, 0) scale(1);
            box-shadow: none;
            filter: brightness(1);
          }
        }

        .pet-eat-burst {
          animation: pokePetEatBurst 0.8s ease-in-out 1;
        }
      `}</style>

      {/* Upload Modal (资料管理区） */}
      <AddResourceModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onNotebookLMStart={handleNotebookLMStart}
        streaming={ingestStreaming}
        streamText={ingestTypedText}
        streamBufferLen={ingestBufferLen}
        streamError={ingestStreamError}
        deepProgressLabel={deepProgressLabel}
        mermaidCode={mermaidCode}
        onOpenMap={() => setIsMapOpen(true)}
      />

      {/* Header + Split */}
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-neutral-950/60 px-5 py-3 text-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/knowledge"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-200 transition hover:bg-white/[0.06]"
              >
                ← 返回 Learning Dashboard
              </Link>
              {linkedItemId ? (
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-mono text-cyan-200">
                  来自条目：{linkedItemId}
                </span>
              ) : null}
              {linkedItemLoading ? (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-mono text-slate-300">
                  正在同步条目信息...
                </span>
              ) : linkedItemError ? (
                <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-[11px] font-mono text-rose-100">
                  条目同步失败：{linkedItemError}
                </span>
              ) : linkedItem ? (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono text-emerald-100">
                  已接入 Dashboard 条目
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-xs text-slate-500">URL: /learning?itemId=...&amp;title=...</div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-cyan-200/80">Learning Now</div>
            {linkedItemId && titleEditMode ? (
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  disabled={titleSaving}
                  maxLength={2000}
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-lg font-semibold text-slate-100 outline-none ring-cyan-500/30 placeholder:text-slate-500 focus:ring-2"
                  placeholder="资料标题"
                  aria-label="编辑资料标题"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveDocumentTitle();
                    }
                    if (e.key === "Escape") {
                      setDraftTitle(
                        linkedDetail?.title ||
                          linkedItem?.title ||
                          linkedTitle ||
                          "Transformer架构深度解析"
                      );
                      setTitleEditMode(false);
                    }
                  }}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveDocumentTitle()}
                    disabled={titleSaving || !draftTitle.trim()}
                    className="rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
                  >
                    {titleSaving ? "保存中…" : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(
                        linkedDetail?.title ||
                          linkedItem?.title ||
                          linkedTitle ||
                          "Transformer架构深度解析"
                      );
                      setTitleEditMode(false);
                    }}
                    disabled={titleSaving}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {linkedItemId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(
                        linkedDetail?.title ||
                          linkedItem?.title ||
                          linkedTitle ||
                          "Transformer架构深度解析"
                      );
                      setTitleEditMode(true);
                    }}
                    className="shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/10 p-2 text-sky-400 transition hover:border-sky-400/60 hover:bg-sky-500/20 hover:text-sky-300"
                    aria-label="编辑标题"
                    title="编辑标题"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">
                  {topicTitle}
                </div>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>{difficulty}</span>
              {linkedItem ? (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs text-slate-300">
                    {linkedItem.type}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs text-slate-300">
                    {linkedItem.status}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs text-slate-300">
                    {linkedItem.durationMinutes ? `${linkedItem.durationMinutes} 分钟` : "时长未设置"}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* PokeFocusPet: 计时器区域 + 宠物区域 + EXP进度条 */}
          <div className="justify-self-end">
            <div
              className={[
                "rounded-2xl bg-white/[0.03] px-4 py-3 backdrop-blur",
                subtleBreath,
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                {/* Pet region */}
                <div
                  className={[
                    "flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/25 transition",
                    petEatBurst ? "pet-eat-burst border-cyan-400/40" : "",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPetSprite(selectedPetId, timerState)}
                    alt={PET_NAMES[selectedPetId]}
                    className="h-28 w-28 select-none object-contain pixelated"
                    draggable={false}
                  />
                </div>

                {/* Timer region */}
                <div>
                  <div className="text-xs font-mono text-slate-400">
                    PokeFocusPet · Lv.{pokedexLevel}
                  </div>
                  <div className={["text-2xl font-semibold tabular-nums", timerTextClass].join(" ")}>
                    {formatMMSS(remaining)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-100 transition hover:bg-white/[0.08]"
                    aria-label={running ? "Pause timer" : "Start timer"}
                  >
                    {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={resetTimer}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                    aria-label="Reset timer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* EXP progress bar */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">EXP</span>
                  <span className="font-mono">{feedLevel}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400/80 to-purple-400/80 transition-[width] duration-500"
                    style={{ width: `${feedLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left: Reader / Workspace */}
          <div className="w-[60%] min-w-0 border-r border-white/5 bg-neutral-900/25">
            <div className="flex h-full min-h-0 flex-col">
              {/* Tabs */}
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("raw")}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm transition",
                      tab === "raw"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5",
                    ].join(" ")}
                  >
                    资料原文
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("outline");
                      setCurrentStep(1);
                      setSelectedConcept(null);
                      setQuizFeedback("none");
                    }}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm transition",
                      tab === "outline"
                        ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5",
                    ].join(" ")}
                  >
                    AI 提炼大纲
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("diagram")}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm transition",
                      tab === "diagram"
                        ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5",
                    ].join(" ")}
                  >
                    思维导图
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("library")}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm transition",
                      tab === "library"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5",
                    ].join(" ")}
                  >
                    全部资料（資料庫）
                  </button>
                </div>

                <div className="hidden text-xs text-slate-500 md:block">
                  {tab === "raw"
                    ? "逐段阅读 + 记录要点"
                    : tab === "outline"
                      ? "结构化复盘 + 快速回忆"
                      : tab === "diagram"
                        ? "用图把核心逻辑串起来"
                        : "管理资料 + NotebookLM 模式整理"}
                </div>

                <div className="hidden md:block">
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    <span className="text-base leading-none">+</span> 添加新资料
                  </button>
                </div>
              </div>

              {/* Scrollable article */}
              <div
                className={[
                  "min-h-0 flex-1 overflow-auto pb-10",
                  tab === "diagram"
                    ? "flex flex-col px-0"
                    : "px-5",
                  tab === "raw" || tab === "outline" || tab === "diagram"
                    ? ""
                    : "scrollbar-hidden",
                ].join(" ")}
                style={{
                  scrollbarWidth:
                    tab === "raw" || tab === "outline" || tab === "diagram" ? "auto" : "none",
                }}
              >
                <article
                  className={[
                    tab === "diagram"
                      ? "flex min-h-full min-w-0 flex-1 flex-col border-0 bg-transparent p-0 shadow-none"
                      : "rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm",
                  ].join(" ")}
                >
                  {tab === "raw" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-mono text-cyan-200/80">
                          Source · Notion
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-mono text-slate-300">
                          {linkedDetailLoading
                            ? "Loading..."
                            : linkedDetailError
                              ? "Error"
                              : "Synced"}
                        </div>
                      </div>

                      <h2 className="mt-3 text-xl font-semibold text-slate-100">
                        {topicTitle}
                      </h2>
                      <div className="mt-3">
                        {linkedDetailLoading ? (
                          <div className="text-sm text-slate-300">正在从 Notion 同步资料原文…</div>
                        ) : linkedDetailError ? (
                          <div className="text-sm text-rose-200">同步失败：{linkedDetailError}</div>
                        ) : (sessionRawText || linkedDetail?.rawText) ? (
                          <>
                            <div className="sticky top-0 z-20 -mx-4 mb-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-400">筛选</span>
                                <input
                                  value={rawFilterQuery}
                                  onChange={(e) => setRawFilterQuery(e.target.value)}
                                  placeholder="输入关键词（高亮匹配并可跳转）"
                                  className="min-w-[260px] flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                                />
                                {rawFilterQuery.trim() ? (
                                  <button
                                    type="button"
                                    onClick={() => setRawFilterQuery("")}
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                  >
                                    清空
                                  </button>
                                ) : null}

                                {rawFilterQuery.trim() ? (
                                  <div className="ml-auto flex items-center gap-2">
                                    <span className="text-[11px] font-mono text-slate-400">
                                      共筛选到 {rawMatchCount} 处
                                      {rawMatchCount
                                        ? `（${rawMatchIndex + 1}/${rawMatchCount}）`
                                        : ""}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={goRawPrevMatch}
                                      disabled={!rawMatchCount}
                                      className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      上一处
                                    </button>
                                    <button
                                      type="button"
                                      onClick={goRawNextMatch}
                                      disabled={!rawMatchCount}
                                      className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      下一处
                                    </button>
                                  </div>
                                ) : null}
                              </div>

                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-mono text-slate-500">
                                {rawCollapsed ? "Collapsed view" : "Expanded view"}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
                                  <span className="text-[11px] font-mono text-slate-400">画笔</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRawAnnotEnabled((v) => {
                                        const next = !v;
                                        // 开启画笔时强制展开原文，避免只能标注前几行
                                        if (next) setRawCollapsed(false);
                                        return next;
                                      })
                                    }
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    aria-pressed={rawAnnotEnabled}
                                  >
                                    {rawAnnotEnabled ? "ON" : "OFF"}
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setRawAnnotTool("highlighter")}
                                      className={[
                                        "rounded-md border px-2 py-0.5 text-xs font-semibold transition",
                                        rawAnnotTool === "highlighter"
                                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
                                      ].join(" ")}
                                    >
                                      高亮
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRawAnnotTool("pen")}
                                      className={[
                                        "rounded-md border px-2 py-0.5 text-xs font-semibold transition",
                                        rawAnnotTool === "pen"
                                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
                                      ].join(" ")}
                                    >
                                      笔
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRawAnnotTool("eraser")}
                                      className={[
                                        "rounded-md border px-2 py-0.5 text-xs font-semibold transition",
                                        rawAnnotTool === "eraser"
                                          ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
                                      ].join(" ")}
                                    >
                                      橡皮
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRawAnnotSize((s) => Math.max(2, Math.round((s - 1) * 10) / 10))
                                      }
                                      className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                      aria-label="减小笔触"
                                    >
                                      -
                                    </button>
                                    <span className="w-10 text-center font-mono text-xs text-slate-200">
                                      {rawAnnotSize}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRawAnnotSize((s) => Math.min(20, Math.round((s + 1) * 10) / 10))
                                      }
                                      className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                      aria-label="增大笔触"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={clearRawAnnotations}
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                  >
                                    清空
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
                                  <span className="text-[11px] font-mono text-slate-400">字号</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRawFontScale((s) => Math.max(0.85, Math.round((s - 0.1) * 100) / 100))
                                    }
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    aria-label="缩小字号"
                                  >
                                    -
                                  </button>
                                  <span className="w-10 text-center font-mono text-xs text-slate-200">
                                    {Math.round(rawFontScale * 100)}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRawFontScale((s) => Math.min(1.4, Math.round((s + 0.1) * 100) / 100))
                                    }
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    aria-label="放大字号"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRawCollapsed((v) => {
                                      const next = !v;
                                      // 折叠后画布区域会变小，直接关掉画笔防止误操作
                                      if (next) setRawAnnotEnabled(false);
                                      return next;
                                    })
                                  }
                                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                >
                                  {rawCollapsed ? "展开原文" : "折叠原文"}
                                </button>
                              </div>
                            </div>

                            <div
                              className={[
                                "relative mt-3 rounded-2xl border border-white/10 bg-black/20 p-4",
                                rawCollapsed ? "max-h-[420px] overflow-hidden" : "",
                              ].join(" ")}
                              ref={rawAnnotWrapRef}
                            >
                              <canvas
                                ref={rawAnnotCanvasRef}
                                className="absolute inset-0 z-10 h-full w-full"
                                style={{
                                  pointerEvents: canDrawRaw ? "auto" : "none",
                                  cursor: canDrawRaw
                                    ? rawAnnotTool === "eraser"
                                      ? "cell"
                                      : "crosshair"
                                    : "default",
                                  touchAction: "none",
                                }}
                                onPointerDown={(e) => startRawDrawing(e)}
                                onPointerMove={(e) => moveRawDrawing(e)}
                                onPointerUp={() => endRawDrawing()}
                                onPointerCancel={() => endRawDrawing()}
                                onPointerLeave={() => endRawDrawing()}
                              />
                              <div
                                className={[
                                  rawFilterQuery.trim()
                                    ? "whitespace-pre-wrap break-words leading-relaxed text-slate-300"
                                    : [
                                        "prose prose-invert max-w-none w-full break-words leading-relaxed text-slate-300",
                                        "prose-headings:scroll-mt-24 prose-a:text-cyan-300 prose-strong:text-slate-100",
                                        "prose-li:marker:text-slate-500",
                                      ].join(" "),
                                ].join(" ")}
                                style={{ fontSize: `${14 * rawFontScale}px` }}
                              >
                                {rawFilterQuery.trim() ? (
                                  rawTextHighlighted
                                ) : (
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={rawMarkdownComponents}
                                  >
                                    {rawTextSource}
                                  </ReactMarkdown>
                                )}
                              </div>

                              {rawCollapsed ? (
                                <div
                                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
                                  style={{
                                    background:
                                      "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.65) 55%, rgba(0,0,0,0.85))",
                                  }}
                                />
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-400">
                            该条目没有可提取的原文内容（Notion 页面 blocks 为空，或内容类型暂不支持提取）。
                          </div>
                        )}
                      </div>

                      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs font-mono text-slate-400">建议阅读节奏</div>
                        <div className="mt-2 text-sm leading-relaxed text-slate-300">
                          每完成一个小段，就在右侧对话框向 AI 面试官/导师提出一句“为什么”。你也可以切换到「AI 提炼大纲」快速复盘。
                        </div>
                      </div>
                    </>
                  ) : tab === "outline" ? (
                    <>
                      {/* Left: AI 提炼大纲（Progressive Disclosure: 步步为营） */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="text-xs font-mono text-slate-400">
                            NotebookLM · Summary
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[11px] font-mono text-purple-100">
                            <Sparkles className="h-3.5 w-3.5" />
                            {lastRefineModel}
                          </span>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-mono text-slate-300">
                          {linkedDetail?.outlineMarkdown?.trim()
                            ? "Synced"
                            : `Step ${currentStep}/4`}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleRefineAndWriteBack}
                            disabled={!linkedItemId || refineLoading}
                            aria-busy={refineLoading}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                          >
                            <RefreshCw
                              className={["h-4 w-4", refineLoading ? "animate-spin" : ""].join(" ")}
                            />
                            {refineLoading ? "重新提炼中..." : "一键重新提炼并回写"}
                          </button>
                          {refineLoading && refineProgressUi ? (
                            <div
                              className="flex min-w-[200px] max-w-md flex-1 flex-col gap-1"
                              role="status"
                              aria-live="polite"
                              aria-label="重新提炼进度"
                            >
                              <div
                                className="h-2 w-full overflow-hidden rounded-full bg-white/10"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(refineProgressUi.pct)}
                              >
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-500/85 via-emerald-500/70 to-cyan-400/80 transition-[width] duration-500 ease-out"
                                  style={{ width: `${refineProgressUi.pct}%` }}
                                />
                              </div>
                              <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-mono text-slate-400">
                                <span>{refineProgressUi.label}</span>
                                <span className="text-slate-500">
                                  已用 {refineProgressUi.elapsedSec}s ·
                                  估算按约 {Math.round(REFINE_CLIENT_ESTIMATE_MS / 1000)}s
                                </span>
                              </div>
                            </div>
                          ) : null}
                          {refineError ? (
                            <span className="text-sm text-rose-200">失败：{refineError}</span>
                          ) : null}
                        </div>
                        <span className="text-xs text-slate-500">
                          将基于当前「资料原文」重新生成大纲并写回 Notion（会替换旧大纲正文，不再重复叠加）。
                        </span>
                      </div>

                      <div className="sticky top-0 z-20 -mx-4 mb-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">筛选</span>
                          <input
                            value={outlineFilterQuery}
                            onChange={(e) => setOutlineFilterQuery(e.target.value)}
                            placeholder="输入关键词（高亮匹配并可跳转）"
                            className="min-w-[260px] flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                          />
                          {outlineFilterQuery.trim() ? (
                            <button
                              type="button"
                              onClick={() => setOutlineFilterQuery("")}
                              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                            >
                              清空
                            </button>
                          ) : null}

                          {outlineFilterQuery.trim() ? (
                            <div className="ml-auto flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-400">
                                共筛选到 {outlineHitCount} 处
                                {outlineHitCount ? `（${outlineMatchIndex + 1}/${outlineHitCount}）` : ""}
                              </span>
                              <button
                                type="button"
                                onClick={goOutlinePrevMatch}
                                disabled={!outlineHitCount}
                                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                上一处
                              </button>
                              <button
                                type="button"
                                onClick={goOutlineNextMatch}
                                disabled={!outlineHitCount}
                                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                下一处
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        {(sessionAiSummary || linkedDetail?.outlineMarkdown)?.trim() ? (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-mono text-slate-400">
                                AI 提炼大纲（来自 Notion「核心知识提炼」）
                              </div>
                              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
                                <span className="text-[11px] font-mono text-slate-400">画笔</span>
                                <button
                                  type="button"
                                  onClick={() => setOutlineAnnotEnabled((v) => !v)}
                                  className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                  aria-pressed={outlineAnnotEnabled}
                                >
                                  {outlineAnnotEnabled ? "ON" : "OFF"}
                                </button>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setOutlineAnnotTool("highlighter")}
                                    className={[
                                      "rounded-md border px-2 py-0.5 text-xs font-semibold transition",
                                      outlineAnnotTool === "highlighter"
                                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
                                    ].join(" ")}
                                  >
                                    高亮
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOutlineAnnotTool("pen")}
                                    className={[
                                      "rounded-md border px-2 py-0.5 text-xs font-semibold transition",
                                      outlineAnnotTool === "pen"
                                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
                                    ].join(" ")}
                                  >
                                    笔
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOutlineAnnotTool("eraser")}
                                    className={[
                                      "rounded-md border px-2 py-0.5 text-xs font-semibold transition",
                                      outlineAnnotTool === "eraser"
                                        ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]",
                                    ].join(" ")}
                                  >
                                    橡皮
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOutlineAnnotSize((s) =>
                                        Math.max(2, Math.round((s - 1) * 10) / 10)
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    aria-label="减小笔触"
                                  >
                                    -
                                  </button>
                                  <span className="w-10 text-center font-mono text-xs text-slate-200">
                                    {outlineAnnotSize}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOutlineAnnotSize((s) =>
                                        Math.min(20, Math.round((s + 1) * 10) / 10)
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    aria-label="增大笔触"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={clearOutlineAnnotations}
                                  className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                >
                                  清空
                                </button>
                              </div>
                            </div>
                            <div
                              className="relative mt-3 rounded-xl border border-white/10 bg-black/20 p-4"
                              ref={(el) => {
                                outlineAnnotWrapRef.current = el;
                                outlineMarkdownMountRef.current = el;
                              }}
                            >
                              <canvas
                                ref={outlineAnnotCanvasRef}
                                className="absolute inset-0 z-10 h-full w-full rounded-xl"
                                style={{
                                  pointerEvents: canDrawOutline ? "auto" : "none",
                                  cursor: canDrawOutline
                                    ? outlineAnnotTool === "eraser"
                                      ? "cell"
                                      : "crosshair"
                                    : "default",
                                  touchAction: "none",
                                }}
                                onPointerDown={(e) => startOutlineDrawing(e)}
                                onPointerMove={(e) => moveOutlineDrawing(e)}
                                onPointerUp={() => endOutlineDrawing()}
                                onPointerCancel={() => endOutlineDrawing()}
                                onPointerLeave={() => endOutlineDrawing()}
                              />
                              <div className="prose prose-invert max-w-none w-full prose-headings:scroll-mt-24 prose-a:text-cyan-300 prose-strong:text-slate-100 prose-li:marker:text-slate-500">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={outlineRehypePlugins}
                                  components={outlineMarkdownComponents}
                                >
                                  {outlineTextSource}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {!linkedDetail?.outlineMarkdown?.trim() && currentStep === 1 ? (
                          <div className="space-y-3">
                            <TLDRCard text="本文核心：Transformer是如何让AI学会联系上下文的。" />
                            <button
                              type="button"
                              onClick={goOutlineNext}
                              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                            >
                              秒懂，下一步
                            </button>
                          </div>
                        ) : null}

                        {!linkedDetail?.outlineMarkdown?.trim() && currentStep === 2 ? (
                          <div className="space-y-3">
                            <ConceptChips items={["Query", "Key", "Value"]} />
                            <div className="text-xs text-slate-500">
                              你当前聚焦：{selectedConcept ?? "点击一个概念标签开始"}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {["Query", "Key", "Value"].map((c) => (
                                <button
                                  key={`focus-${c}`}
                                  type="button"
                                  onClick={() => setSelectedConcept(c)}
                                  className={[
                                    "rounded-lg border px-3 py-1.5 text-xs transition",
                                    selectedConcept === c
                                      ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-100"
                                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                                  ].join(" ")}
                                >
                                  聚焦 {c}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={goOutlineNext}
                              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                            >
                              记住了，下一步
                            </button>
                          </div>
                        ) : null}

                        {!linkedDetail?.outlineMarkdown?.trim() && currentStep === 3 ? (
                          <div className="space-y-3">
                            <LogicChain
                              steps={[
                                { title: "输入", desc: "用户输入进入编码空间" },
                                { title: "编码", desc: "形成可比较的特征表示" },
                                { title: "注意力分配", desc: "为关键上下文分配更高权重" },
                                { title: "输出", desc: "组合上下文并生成最终结果" },
                              ]}
                            />
                            <button
                              type="button"
                              onClick={goOutlineNext}
                              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                            >
                              逻辑通了，下一步
                            </button>
                          </div>
                        ) : null}

                        {!linkedDetail?.outlineMarkdown?.trim() && currentStep === 4 ? (
                          <div className="space-y-3">
                            <MicroCheck
                              question="小测验：注意力机制主要是为了解决什么问题？"
                              onAnswer={handleOutlineQuiz}
                            />
                            {quizFeedback === "correct" ? (
                              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                恭喜答对！右侧已为您开启面试考核。
                              </div>
                            ) : quizFeedback === "wrong" ? (
                              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                                这题再想一步：注意力机制更关键是缓解长距离依赖与遗忘问题。
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : tab === "diagram" ? (
                    <>
                      {/* Diagram: 思维导图 — 顶栏留白，导图区横向铺满左栏 */}
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <div className="shrink-0 border-b border-white/10 bg-white/[0.02] px-5 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-slate-400">思维导图 · Mermaid</div>
                              <p className="mt-1 text-xs text-slate-500">
                                基于当前资料原文重新生成全文大纲与文末 mindmap，并写回 Notion（与「AI
                                提炼大纲」为同一接口）。
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={handleRefineAndWriteBack}
                                disabled={!linkedItemId || refineLoading}
                                aria-busy={refineLoading}
                                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                              >
                                <RefreshCw
                                  className={["h-4 w-4", refineLoading ? "animate-spin" : ""].join(
                                    " "
                                  )}
                                />
                                {refineLoading ? "重新提炼中..." : "一键重新提炼并回写"}
                              </button>
                              {refineLoading && refineProgressUi ? (
                                <div
                                  className="flex w-full min-w-[200px] max-w-sm flex-col gap-1 sm:w-64"
                                  role="status"
                                  aria-live="polite"
                                  aria-label="重新提炼进度"
                                >
                                  <div
                                    className="h-2 w-full overflow-hidden rounded-full bg-white/10"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(refineProgressUi.pct)}
                                  >
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-cyan-500/85 via-emerald-500/70 to-cyan-400/80 transition-[width] duration-500 ease-out"
                                      style={{ width: `${refineProgressUi.pct}%` }}
                                    />
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    {refineProgressUi.label} · 已用 {refineProgressUi.elapsedSec}s
                                  </div>
                                </div>
                              ) : null}
                              {refineError ? (
                                <span className="max-w-xs text-right text-xs text-rose-200">
                                  失败：{refineError}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="min-h-0 min-w-0 flex-1">
                          {outlineMermaidCode ? (
                            <MermaidBlock
                              className="my-0 h-full rounded-none"
                              code={outlineMermaidCode}
                              zoomable
                              onRequestFullscreen={() => setDiagramMindmapFullscreen(true)}
                            />
                          ) : (
                            <div className="mx-5 mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                              文档较短或暂无生成思维导图（Mermaid）。你可以先切到「AI
                              提炼大纲」上传/同步，或使用上方按钮根据 Notion 原文重新提炼。
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Library: 资料管理 + NotebookLM 模式入口 */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-cyan-200/80">資料庫 · Notion</div>
                          <h2 className="mt-3 truncate text-xl font-semibold text-slate-100">
                            你的全部资料
                          </h2>
                          <p className="mt-2 text-sm text-slate-400">
                            {libraryLoading ? (
                              "正在同步…"
                            ) : libraryError ? (
                              <span className="text-rose-200">同步失败：{libraryError}</span>
                            ) : (
                              <>
                                共{" "}
                                <span className="font-mono text-cyan-200">{libraryItems.length}</span>{" "}
                                份
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadOpen(true)}
                          className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          + 添加新资料
                        </button>
                      </div>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-200">
                            资料列表（来自 Dashboard）
                          </div>
                          <div className="text-xs text-slate-500">
                            {linkedItemId ? "当前条目已高亮" : "未选中条目"}
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {libraryLoading ? (
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                              Loading...
                            </div>
                          ) : libraryError ? (
                            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
                              {libraryError}
                            </div>
                          ) : libraryItems.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                              暂无资料。请先在 Notion 知识库中添加条目。
                            </div>
                          ) : (
                            libraryItems.slice(0, 30).map((it) => {
                              const active = linkedItemId && it.id === linkedItemId;
                              return (
                                <Link
                                  key={it.id}
                                  href={{ pathname: "/learning", query: { itemId: it.id, title: it.title } }}
                                  className={[
                                    "flex items-start justify-between gap-3 rounded-xl border p-3 transition",
                                    active
                                      ? "border-cyan-500/35 bg-cyan-500/10"
                                      : "border-white/10 bg-black/20 hover:bg-white/[0.04]",
                                  ].join(" ")}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-slate-100">
                                      {it.title}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
                                        {it.type}
                                      </span>
                                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
                                        {it.status}
                                      </span>
                                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
                                        {it.difficulty}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className={[
                                      "shrink-0 rounded-full border px-3 py-1 text-[11px] font-mono",
                                      active
                                        ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200"
                                        : "border-white/10 bg-white/[0.03] text-slate-300",
                                    ].join(" ")}
                                  >
                                    打开 →
                                  </div>
                                </Link>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-slate-500">
                        进入资料库后可持续添加：PDF/Word/思维导图/截图 + 可选视频链接。
                      </div>
                    </>
                  )}
                </article>
              </div>
            </div>
          </div>

          {/* Right: Mentor Chat */}
          <div className="w-[40%] min-w-0 bg-neutral-950/40">
            <div className="flex h-full min-h-0 flex-col">
              {/* Mode switch: 特色学习模式（两排四按钮，抗启动困难/抗内耗） */}
              <div className="border-b border-white/5 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-cyan-200/70">Learning Mode</div>
                    <div className="mt-1 text-sm text-slate-300">
                      当前： {activeMode === "feynman" ? "费曼学习法（故事模式）" : "模拟面试官考核"}
                    </div>
                  </div>
                </div>

                {/* Row A - 核心模式 */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeSelect("story")}
                    className={[
                      "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition",
                        activeMode === "feynman"
                        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-500/20 hover:bg-white/[0.05]",
                    ].join(" ")}
                      aria-pressed={activeMode === "feynman"}
                  >
                    <Lightbulb className="h-4 w-4" />
                    费曼模式解释
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSelect("interview")}
                    className={[
                      "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition",
                        activeMode === "interview"
                        ? "border-purple-500/30 bg-purple-500/10 text-purple-200"
                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-purple-500/20 hover:bg-white/[0.05]",
                    ].join(" ")}
                      aria-pressed={activeMode === "interview"}
                  >
                    <BriefcaseBusiness className="h-4 w-4" />
                    模拟面试官考核
                  </button>
                </div>

                {/* Row B - 反内耗特供（更显眼） */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRandomPeek}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/15 to-white/[0.03] px-3 py-2.5 text-sm font-semibold text-cyan-100 transition hover:from-cyan-500/20 hover:to-white/[0.05]"
                  >
                    <Shuffle className="h-4 w-4" />
                    只想随便看看
                  </button>
                  <button
                    type="button"
                    onClick={handleStartQuick5}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-500/15 to-white/[0.03] px-3 py-2.5 text-sm font-semibold text-purple-100 transition hover:from-purple-500/20 hover:to-white/[0.05]"
                  >
                    <Hourglass className="h-4 w-4" />
                    只学5分钟
                  </button>
                </div>
              </div>

              {activeMode === "interview" ? (
                /* Interview mode: hide text chat, render InterviewVoiceUI */
                <div className="flex-1 min-h-0">
                  <InterviewVoiceUI />
                </div>
              ) : (
                <>
                  {/* Chat stream */}
                  <div
                    ref={chatScrollContainerRef}
                    className="flex-1 min-h-0 overflow-auto px-5 pb-6 pt-3 scrollbar-hidden"
                  >
                    <div ref={scrollRef} className="flex min-h-full flex-col gap-4 pb-2">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={[
                            "flex",
                            m.role === "assistant" ? "justify-start" : "justify-end",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "max-w-[85%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                              m.role === "assistant"
                                ? "border-white/10 bg-white/[0.03] text-slate-100"
                                : "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
                            ].join(" ")}
                          >
                            {m.content}
                            {/* 互动消息：完成后手动切换宠物预览 */}
                            {m.actionKey === "petReward" ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => switchPetPreview(25)}
                                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                >
                                  看皮卡丘
                                </button>
                                <button
                                  type="button"
                                  onClick={() => switchPetPreview(1)}
                                  className="inline-flex items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                                >
                                  看妙蛙种子
                                </button>
                                <button
                                  type="button"
                                  onClick={() => switchPetPreview(7)}
                                  className="inline-flex items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                                >
                                  看杰尼龟
                                </button>
                                <button
                                  type="button"
                                  onClick={() => switchPetPreview(6)}
                                  className="inline-flex items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                                >
                                  看喷火龙
                                </button>
                              </div>
                            ) : null}
                            {m.role === "assistant" && m.id === messages[1]?.id && recommendedVideos.length ? (
                              <RecommendedVideoCard videos={recommendedVideos} />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Input */}
                  <div className="border-t border-white/5 bg-neutral-950/35 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="输入你的问题：例如“注意力为什么需要残差？”"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          aria-label="Chat input"
                        />
                      </div>

                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.06]"
                        aria-label="Voice input (placeholder)"
                        onClick={() => {
                          setMessages((prev) => [
                            ...prev,
                            {
                              id: nowId(),
                              role: "assistant",
                              content:
                                "语音输入目前是占位：你可以先输入文字，我们再一起把问题拆解到可验证的形式。",
                            },
                          ]);
                        }}
                      >
                        <Mic className="h-4.5 w-4.5" />
                      </button>

                      <button
                        type="button"
                        onClick={sendMessage}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-500/15 px-4 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/25 border border-cyan-500/30"
                        aria-label="Send message"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        发送
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      提示：按 `Enter` 发送；倒计时进入紧急阶段时，AI 会更偏向“短问题 + 快速纠错”。
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LearningPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-300">Loading…</div>}>
      <LearningPageInner />
    </Suspense>
  );
}

