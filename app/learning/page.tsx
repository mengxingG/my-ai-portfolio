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
  type ChangeEvent,
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
  ChevronDown,
  Hourglass,
  Lightbulb,
  Loader2,
  Maximize,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Copy,
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
import {
  InterviewConfigPanel,
  type InterviewConfig,
} from "@/app/components/InterviewConfigPanel";
import { InterviewTextUI } from "@/app/components/InterviewTextUI";
import { InterviewReportCard } from "@/app/components/InterviewReportCard";
import {
  PokeFocusPet,
  type PokeFocusPetHandle,
  type TodaySession,
  type TodaySessionMode,
} from "@/app/components/PokeFocusPet";
import { userMessageFromKnowledgeApiPayload } from "@/lib/notion-errors";
import { fixMermaidMindmapInnerSource } from "@/lib/fixMermaidMindmapIndent";
import { trimMermaidSvgToContent } from "@/lib/trimMermaidSvgViewBox";
import { isVideoWatchUrl } from "@/lib/videoWatchUrl";
import { PDFDocument } from "pdf-lib";
import type { InterviewEvaluation } from "@/app/api/interview/evaluate/route";
import {
  isTextUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import type { ElementContent, Root as HastRoot } from "hast";
import {
  createBrowserSpeechSession,
  isBrowserSpeechRecognitionSupported,
  shouldFallbackSpeechRecognitionToCloud,
  speechRecognitionErrorMessage,
  type BrowserSpeechSession,
} from "@/lib/browser-speech-recognition";
import {
  CLOUD_VOICE_RECORDING_MAX_MS,
  VOICE_UPLOAD_LARGE_BYTES,
  createOptimizedVoiceMediaRecorder,
} from "@/lib/voice-media-recorder";

const LEARNING_DOC_OUTLINE_CTX_MAX = 120_000;
const LEARNING_DOC_RAW_CTX_MAX = 80_000;

/** 右侧导师对话调用 /api/chat 时的可选模型（id 须与后端 resolve 一致） */
const LEARNING_CHAT_MODEL_OPTIONS = [
  { id: "gemini-2.5-flash" as const, label: "Gemini 2.5 Flash⚡️" },
  { id: "gemini-2.5-pro" as const, label: "Gemini 2.5 Pro 🧠" },
  { id: "gemini-2.5-pro-thinking" as const, label: "Gemini 2.5 Pro Thinking" },
  { id: "gemini-3-flash-preview" as const, label: "Gemini 3 Flash Preview" },
  { id: "gemini-3-pro-preview" as const, label: "Gemini 3 Pro Preview" },
  { id: "gemini-3-pro-preview-thinking" as const, label: "Gemini 3 Pro Preview Thinking" },
  { id: "gemini-3-pro-preview-thinking-*" as const, label: "Gemini 3 Pro Preview Thinking *" },
  { id: "gemini-3.1-pro-preview" as const, label: "Gemini 3.1 Pro Preview" },
  { id: "gemini-3.1-pro-preview-thinking" as const, label: "Gemini 3.1 Pro Preview Thinking" },
  { id: "deepseek-chat" as const, label: "DeepSeek Chat" },
];
type LearningChatModelId = (typeof LEARNING_CHAT_MODEL_OPTIONS)[number]["id"];

/** 流式正常结束但聚合正文为空时，替换占位气泡的提示 */
const LEARNING_CHAT_EMPTY_REPLY_HINT =
  "这次没有收到有效回复，可能是网络或模型短暂波动。请稍后再试，或把问题改短一点重新发送～";

/** 语音入口：优先 Web Speech 实时识别，不支持时用 MediaRecorder + /api/voice */
const LEARNING_VOICE_INPUT_ENABLED = true;

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

const TODAY_SESSIONS_STORAGE_KEY = "todaySessions:v1";

const PET_LS_EXP = "pet_exp";
const PET_LS_LEVEL = "pet_level";
const PET_LS_STREAK = "pet_streak";
const PET_LS_LAST_DATE = "pet_last_study_date";

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function safeParseTodaySessions(raw: string | null): TodaySession[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: TodaySession[] = [];
    for (const x of j) {
      const startTime = Number((x as any)?.startTime);
      const endTime = Number((x as any)?.endTime);
      const mode = String((x as any)?.mode ?? "") as TodaySessionMode;
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
      if (endTime <= startTime) continue;
      if (mode !== "feynman" && mode !== "interview" && mode !== "peek") continue;
      out.push({ startTime, endTime, mode });
    }
    return out;
  } catch {
    return [];
  }
}

function formatHm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function yyyyMmDdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  actionKey?: ChatActionKey;
  /** 流式生成中，尾部显示光标 */
  streaming?: boolean;
  isError?: boolean;
  retryPayload?: ChatRetryPayload;
};

type ChatRetryPayload =
  | { kind: "chat"; thread: ChatMessage[]; learningRole: "feynman" | "interview" }
  | {
      kind: "synthetic";
      base: ChatMessage[];
      synthetic: string;
      learningRole: "feynman" | "interview";
    };

type MasteryParseResult = { cleanText: string; score: number | null };

function parseMasteryMarker(text: string): MasteryParseResult {
  const raw = String(text ?? "");
  const re = /\[MASTERY_ACHIEVED:(\d{1,3})\]/g;
  let score: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) {
      score = Math.max(0, Math.min(100, Math.round(n)));
    }
  }
  const cleanText = raw.replace(re, "").trimEnd();
  return { cleanText, score };
}

type SessionEvaluation = {
  score: number;
  status: "已完成" | "待复习" | "需重学";
  feedback: string;
  weakPoints: string[];
};

const DEFAULT_SESSION_EVAL: SessionEvaluation = {
  score: 60,
  status: "待复习",
  feedback: "本次学习已完成",
  weakPoints: [],
};

function clampScore(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return DEFAULT_SESSION_EVAL.score;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeEvalStatus(x: unknown): SessionEvaluation["status"] {
  const s = String(x ?? "").trim();
  if (s === "已完成" || s === "待复习" || s === "需重学") return s;
  return DEFAULT_SESSION_EVAL.status;
}

function parseSessionEvaluationFromText(rawText: string): SessionEvaluation {
  const raw = String(rawText ?? "");

  // 1) Try direct JSON first
  const tryParse = (t: string): SessionEvaluation | null => {
    try {
      const j = JSON.parse(t) as Partial<SessionEvaluation> & {
        masteryScore?: unknown;
        suggestion?: unknown;
      };
      const score = clampScore(j.score ?? j.masteryScore);
      const status = normalizeEvalStatus(j.status);
      const feedback = String(j.feedback ?? j.suggestion ?? DEFAULT_SESSION_EVAL.feedback).trim() || DEFAULT_SESSION_EVAL.feedback;
      const weakPoints = Array.isArray(j.weakPoints)
        ? j.weakPoints.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 12)
        : DEFAULT_SESSION_EVAL.weakPoints;
      return { score, status, feedback, weakPoints };
    } catch {
      return null;
    }
  };

  const direct = tryParse(raw);
  if (direct) return direct;

  // 2) Extract first {...} block and try parse
  const m = raw.match(/\{[\s\S]*\}/);
  if (m?.[0]) {
    const extracted = tryParse(m[0]);
    if (extracted) return extracted;
  }

  // 3) Fallback: if marker exists, use it to at least fill score
  const marker = parseMasteryMarker(raw);
  if (typeof marker.score === "number") {
    return { ...DEFAULT_SESSION_EVAL, score: marker.score };
  }

  return DEFAULT_SESSION_EVAL;
}

type FeynmanNote = {
  coreConcept: string;
  bestAnalogy: string;
  keyPrinciples: string[];
  commonMisconceptions: string[];
  userInsights: string;
  weakPoints: string;
  oneLineSummary: string;
};

type SelectedTopic = { id: string; title: string; content: string } | null;

function textFromReactNode(node: ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromReactNode).join("");
  if (isValidElement(node)) {
    return textFromReactNode((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function parseOutlineSections(markdown: string): Array<{
  id: string;
  level: 1 | 2 | 3;
  title: string;
  content: string;
}> {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const heads: Array<{ idx: number; level: 1 | 2 | 3; title: string; id: string }> = [];
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]?.match(/^(#{1,3})\s+(.+)\s*$/);
    if (!m) continue;
    const level = Math.min(3, m[1]!.length) as 1 | 2 | 3;
    const title = String(m[2] ?? "").trim();
    if (!title) continue;
    n += 1;
    heads.push({ idx: i, level, title, id: `h-${n}` });
  }
  if (!heads.length) return [];
  const out: Array<{ id: string; level: 1 | 2 | 3; title: string; content: string }> = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]!;
    let end = lines.length;
    for (let j = i + 1; j < heads.length; j++) {
      const nx = heads[j]!;
      if (nx.level <= h.level) {
        end = nx.idx;
        break;
      }
    }
    const body = lines.slice(h.idx + 1, end).join("\n").trim();
    out.push({ id: h.id, level: h.level, title: h.title, content: body });
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function remarkKeywordLinker(keywords: string[]) {
  const kws = (Array.isArray(keywords) ? keywords : [])
    .map((k) => String(k ?? "").trim())
    .filter(Boolean)
    // 长的优先，避免 “RAG” 抢先命中 “GraphRAG”
    .sort((a, b) => b.length - a.length);

  if (!kws.length) return () => {};
  const pattern = new RegExp(kws.map(escapeRegExp).join("|"), "g");

  return (tree: any) => {
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;

      // 不处理代码块 / 行内代码
      if (node.type === "code" || node.type === "inlineCode") return;
      // 已经是链接了也不动，避免把普通 URL 文本弄乱
      if (node.type === "link") return;

      const children: any[] | undefined = Array.isArray(node.children) ? node.children : undefined;
      if (!children) return;

      const out: any[] = [];
      for (const ch of children) {
        if (ch?.type === "text" && typeof ch.value === "string") {
          const value: string = ch.value;
          if (!value || !pattern.test(value)) {
            out.push(ch);
            continue;
          }
          pattern.lastIndex = 0;
          let last = 0;
          let m: RegExpExecArray | null = null;
          while ((m = pattern.exec(value))) {
            const start = m.index;
            const hit = m[0] ?? "";
            const end = start + hit.length;
            if (start > last) out.push({ type: "text", value: value.slice(last, start) });
            out.push({
              type: "link",
              url: `kw:${encodeURIComponent(hit)}`,
              children: [{ type: "text", value: hit }],
            });
            last = end;
          }
          if (last < value.length) out.push({ type: "text", value: value.slice(last) });
          continue;
        }
        out.push(ch);
      }
      node.children = out;

      for (const ch of node.children) visit(ch);
    };

    visit(tree);
  };
}


function firstLinePreview(text: string, maxLen = 36): string {
  const s = String(text ?? "").replace(/\r/g, "").trim();
  const line = (s.split("\n")[0] ?? "").trim();
  if (!line) return "（空）";
  return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
}

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
        <div className="mr-auto hidden items-center gap-3 text-[11px] text-slate-500 sm:flex">
          <span>滚轮缩放 · 拖拽平移</span>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-cyan-200/90">
            点击节点 → 进入费曼对话
          </span>
        </div>
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
  onPickTopic,
  activeTopicTitle,
}: {
  code: string;
  zoomable?: boolean;
  className?: string;
  /** embedded：左栏默认高度；fullscreen：全屏弹层内铺满视口 */
  zoomLayout?: "embedded" | "fullscreen";
  onRequestFullscreen?: () => void;
  onPickTopic?: (topic: { id: string; title: string; content: string }) => void;
  activeTopicTitle?: string | null;
}) {
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef(`mmd-${nowId()}`);
  const zoomShellRef = useRef<HTMLDivElement | null>(null);
  const lastActiveNodeRef = useRef<SVGGElement | null>(null);

  const hashId = useCallback((s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `mm-${(h >>> 0).toString(16)}`;
  }, []);

  const pickFromEvent = useCallback(
    (e: React.MouseEvent) => {
      if (!onPickTopic) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const g = (target.closest("g") as SVGGElement | null) ?? null;
      if (!g) return;
      const textEl = (g.querySelector("text") as SVGTextElement | null) ?? null;
      const title = String(textEl?.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!title) return;
      onPickTopic({ id: hashId(title), title, content: "" });
    },
    [hashId, onPickTopic]
  );

  useEffect(() => {
    // Mermaid 渲染完成后：给节点绑 hover/click（避免 SVG 默认无交互）
    const root = zoomShellRef.current;
    if (!root) return;
    const svgEl = root.querySelector("svg");
    if (!svgEl) return;
    const selector = ".node, .mindmap-node, [class*='node']";
    const nodes = Array.from(svgEl.querySelectorAll(selector)) as Element[];
    if (!nodes.length) return;

    const cleanups: Array<() => void> = [];
    for (const el of nodes) {
      const g = (el as any) as SVGGElement;
      try {
        (g as unknown as HTMLElement).style.cursor = onPickTopic ? "pointer" : "";
      } catch {}

      const onEnter = () => {
        try {
          (g as unknown as HTMLElement).style.opacity = "0.7";
          (g as unknown as HTMLElement).style.filter = "drop-shadow(0 0 6px #00ffd5)";
        } catch {}
      };
      const onLeave = () => {
        try {
          (g as unknown as HTMLElement).style.opacity = "";
          (g as unknown as HTMLElement).style.filter = "";
        } catch {}
      };
      const onClick = (evt: Event) => {
        if (!onPickTopic) return;
        evt.preventDefault();
        evt.stopPropagation();
        const textNode =
          (g.querySelector("text") as SVGTextElement | null) ??
          (g.querySelector("tspan") as SVGElement | null) ??
          (g.querySelector("foreignObject") as SVGElement | null);
        const title = String(textNode?.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!title) return;

        // 高亮：恢复上一个
        const prev = lastActiveNodeRef.current;
        if (prev && prev !== g) {
          prev.removeAttribute("data-mmd-clicked");
          (prev as unknown as HTMLElement).style.filter = "";
          const prevShape = prev.querySelector("rect, path, polygon, circle, ellipse") as SVGElement | null;
          if (prevShape) {
            prevShape.style.stroke = "";
            prevShape.style.strokeWidth = "";
          }
        }
        lastActiveNodeRef.current = g;
        g.setAttribute("data-mmd-clicked", "1");
        (g as unknown as HTMLElement).style.filter = "drop-shadow(0 0 10px rgba(34,211,238,0.35))";
        const shape = g.querySelector("rect, path, polygon, circle, ellipse") as SVGElement | null;
        if (shape) {
          shape.style.stroke = "#00ffd5";
          shape.style.strokeWidth = "2px";
        }

        onPickTopic({ id: hashId(title), title, content: title });
      };

      g.addEventListener("mouseenter", onEnter);
      g.addEventListener("mouseleave", onLeave);
      g.addEventListener("click", onClick);
      cleanups.push(() => {
        g.removeEventListener("mouseenter", onEnter);
        g.removeEventListener("mouseleave", onLeave);
        g.removeEventListener("click", onClick);
        try {
          (g as unknown as HTMLElement).style.cursor = "";
          (g as unknown as HTMLElement).style.opacity = "";
        } catch {}
      });
    }
    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [svg, onPickTopic, hashId]);

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

  useEffect(() => {
    const root = zoomShellRef.current;
    if (!root) return;
    const svgEl = root.querySelector("svg");
    if (!svgEl) return;
    // clear previous
    svgEl.querySelectorAll("[data-mmd-active='1']").forEach((el) => {
      el.removeAttribute("data-mmd-active");
      (el as HTMLElement).style.filter = "";
      const shape = (el as Element).querySelector("rect, path, polygon, circle, ellipse") as
        | SVGElement
        | null;
      if (shape) {
        shape.style.stroke = "";
        shape.style.strokeWidth = "";
        shape.style.fill = "";
      }
    });
    const t = String(activeTopicTitle ?? "").trim();
    if (!t) return;
    const texts = Array.from(svgEl.querySelectorAll("text")) as SVGTextElement[];
    const hit = texts.find((x) => String(x.textContent ?? "").replace(/\s+/g, " ").trim() === t);
    const g = hit?.closest("g") as SVGGElement | null;
    if (!g) return;
    g.setAttribute("data-mmd-active", "1");
    (g as unknown as HTMLElement).style.filter = "drop-shadow(0 0 10px rgba(34,211,238,0.35))";
    const shape = g.querySelector("rect, path, polygon, circle, ellipse") as SVGElement | null;
    if (shape) {
      shape.style.stroke = "rgba(34,211,238,0.95)";
      shape.style.strokeWidth = "2px";
      // keep fill but brighten a bit
      if (!shape.style.fill) shape.style.fill = "rgba(34,211,238,0.12)";
    }
  }, [activeTopicTitle, svg]);

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
      ref={zoomShellRef}
      className={svgHostClass}
      // mermaid.render 返回的是 SVG 字符串
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );

  if (!zoomable) {
    return (
      <div className="my-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-3">
        <div onClick={pickFromEvent}>{svgNode}</div>
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
              <div onClick={pickFromEvent}>{svgNode}</div>
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

function getFriendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const lower = msg.toLowerCase();
  if (
    lower.includes("network") ||
    lower.includes("socket") ||
    lower.includes("tls") ||
    lower.includes("connect") ||
    lower.includes("timeout") ||
    lower.includes("fetch") ||
    msg.includes("Failed to fetch")
  ) {
    return "网络开小差了，请检查网络后点击重试 🔄";
  }
  if (msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
    return "AI 服务暂时不可用，请稍后再试";
  }
  if (msg.includes("429") || lower.includes("rate limit")) {
    return "AI 太忙了，请等待 10 秒后重试 ⏳";
  }
  return "出了点小问题，请重试一下 🔄";
}

function uiMessageChunkReadableFromBody(
  body: ReadableStream<Uint8Array>
): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({
    stream: body,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) throw chunk.error;
        controller.enqueue(chunk.value);
      },
    })
  );
}

function chatThreadToUiMessages(thread: Array<{ id: string; role: "assistant" | "user"; content: string }>): UIMessage[] {
  return thread.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
  }));
}

function learningWelcomeMessages(docTitle: string): Array<{
  id: string;
  role: "assistant";
  content: string;
}> {
  const title = docTitle.trim() || "当前资料";
  return [
    {
      id: nowId(),
      role: "assistant",
      content: `你好！我是你的费曼导师。关于这篇《${title}》，你想从哪个概念开始挑战？`,
    },
    {
      id: nowId(),
      role: "assistant",
      content:
        "你可以从下面 4 个按钮里随便点一个开始：\n- 费曼学习法\n- 模拟面试官考核\n- 只想随便看看\n- 只学 5 分钟",
    },
  ];
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
  onCollapse,
}: {
  videos: Array<{
    id: string;
    title: string;
    source: VideoRecSource;
    url: string;
  }>;
  onCollapse?: () => void;
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
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-mono text-cyan-200">
            3 mins · Quick Win
          </div>
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.06]"
              aria-label="折叠视频推荐"
              title="折叠"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : null}
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
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度推理)</option>
                <optgroup label="备用（更细分）">
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
  /** 空内容点发送时，显示在输入区右侧按钮组上方（不使用全局 fixed toast） */
  const [chatEmptySendHint, setChatEmptySendHint] = useState<string | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const refineStartedAtRef = useRef(0);
  const [refineProgressTick, setRefineProgressTick] = useState(0);
  const [lastRefineModel, setLastRefineModel] = useState<string>("Gemini 3.1 Pro");
  const [rawCollapsed, setRawCollapsed] = useState(true);
  const [rawFontScale, setRawFontScale] = useState<number>(1);
  const [rawFilterQuery, setRawFilterQuery] = useState<string>("");
  const [rawEditMode, setRawEditMode] = useState(false);
  const [rawDraftText, setRawDraftText] = useState<string>("");
  const [rawEditSaving, setRawEditSaving] = useState(false);
  const [videoRecCollapsed, setVideoRecCollapsed] = useState(false);
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
  const [selectedTopic, setSelectedTopic] = useState<SelectedTopic>(null);
  const lastSelectedTopicIdRef = useRef<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<"none" | "correct" | "wrong">("none");
  const [outlineHintOpen, setOutlineHintOpen] = useState(false);
  const [outlineOnboardDot, setOutlineOnboardDot] = useState(false);

  const [rawAutoKeyword, setRawAutoKeyword] = useState<string | null>(null);
  const rawAutoParaRef = useRef<HTMLParagraphElement | null>(null);
  const lastProcessedAssistantIdRef = useRef<string | null>(null);
  const [assistantKwHits, setAssistantKwHits] = useState<Record<string, string[]>>({});

  const [titleEditMode, setTitleEditMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);

  useEffect(() => {
    setTitleEditMode(false);
  }, [linkedItemId]);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem("learning:outlineHintDismissed") === "1";
      setOutlineHintOpen(!dismissed);
      const onboardDone = window.localStorage.getItem("learning:outlineOnboardDone") === "1";
      setOutlineOnboardDot(!onboardDone);
    } catch {
      setOutlineHintOpen(true);
      setOutlineOnboardDot(false);
    }
  }, []);

  useEffect(() => {
    // 切换到其他条目时，退出原文编辑模式并重置草稿，避免把旧内容保存到新条目。
    setRawEditMode(false);
    setRawDraftText("");
    setRawEditSaving(false);
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
    const data = (await res.json()) as { item?: KnowledgeDetail; error?: string; code?: string };
    if (!res.ok) throw new Error(userMessageFromKnowledgeApiPayload(data));
    setLinkedDetail(data.item ?? null);
  }, [linkedItemId]);

  const saveRawTextToNotion = useCallback(async () => {
    if (!linkedItemId || rawEditSaving) return;
    setRawEditSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(linkedItemId)}/rawtext`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawDraftText }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data?.ok) throw new Error(data?.error || "保存失败");

      setToast("资料原文已保存到 Notion");
      window.setTimeout(() => setToast(null), 2600);
      setRawEditMode(false);
      setRawDraftText("");
      await reloadLinkedDetail();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "保存失败");
    } finally {
      setRawEditSaving(false);
    }
  }, [linkedItemId, rawDraftText, rawEditSaving, reloadLinkedDetail]);

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

    setSessionRawText("");
    sessionRawTextRef.current = "";
    setSessionAiSummary("");
    sessionAiSummaryRef.current = "";

    let active = true;
    void (async () => {
      try {
        setLinkedDetailLoading(true);
        setLinkedDetailError(null);
        const res = await fetch(`/api/knowledge/${encodeURIComponent(linkedItemId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { item?: KnowledgeDetail; error?: string; code?: string };
        // eslint-disable-next-line no-console
        console.log("[LearningPage] /api/knowledge/:id response:", {
          ok: res.ok,
          status: res.status,
          data,
        });
        if (!res.ok) throw new Error(userMessageFromKnowledgeApiPayload(data));
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
    linkedDetail?.title || linkedItem?.title || linkedTitle || "当前资料";

  const documentContext = useMemo(() => {
    const title = linkedDetail?.title || linkedItem?.title || linkedTitle || "当前资料";
    const outline = String(sessionAiSummary || linkedDetail?.outlineMarkdown || "")
      .replace(/\\n/g, "\n")
      .trim();
    const raw = String(sessionRawText || linkedDetail?.rawText || "")
      .replace(/\\n/g, "\n")
      .trim();
    const outlineTrunc = outline.slice(0, LEARNING_DOC_OUTLINE_CTX_MAX);
    const rawTrunc = raw.slice(0, LEARNING_DOC_RAW_CTX_MAX);
    const parts = [`标题：${title}`];
    if (outlineTrunc) parts.push("", "【内容大纲（AI 提炼）】", outlineTrunc);
    if (rawTrunc) parts.push("", "【资料原文（节选）】", rawTrunc);
    return parts.join("\n").trim();
  }, [
    linkedDetail?.outlineMarkdown,
    linkedDetail?.rawText,
    linkedDetail?.title,
    linkedItem?.title,
    linkedTitle,
    sessionAiSummary,
    sessionRawText,
  ]);

  useEffect(() => {
    if (!titleEditMode) {
      setDraftTitle(
        linkedDetail?.title || linkedItem?.title || linkedTitle || "当前资料"
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
      const data = (await res.json()) as { error?: string; title?: string; code?: string };
      if (!res.ok) throw new Error(userMessageFromKnowledgeApiPayload(data));
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

  // Focus companion: 正计时（从 0 开始累积）
  const [elapsedSec, setElapsedSec] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [selectedPetId, setSelectedPetId] = useState<PetId>(25);
  const [feedLevel, setFeedLevel] = useState(0);
  const [pokedexLevel, setPokedexLevel] = useState(1);
  const [petEatBurst, setPetEatBurst] = useState(false);
  const [petLevelUpBurst, setPetLevelUpBurst] = useState(false);
  const [petBubble, setPetBubble] = useState<string | null>(null);
  const [petStreak, setPetStreak] = useState(1);
  const [petEmoji, setPetEmoji] = useState<"🙂" | "😎" | "👑">("🙂");
  const [petBadge, setPetBadge] = useState<string | null>(null);

  // Right: Learning modes (特色学习模式)
  const [mode, setMode] = useState<LearningModeKey>("story");
  const [activeMode, setActiveMode] = useState<"feynman" | "interview">("feynman");
  const [interviewConfigured, setInterviewConfigured] = useState(false);
  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig>(() => ({
    questionCount: 5,
    answerMode: "voice",
  }));
  const [interviewReport, setInterviewReport] = useState<InterviewEvaluation | null>(null);
  const [interviewReportLoading, setInterviewReportLoading] = useState(false);
  const [interviewReportSaving, setInterviewReportSaving] = useState(false);
  const [interviewReportError, setInterviewReportError] = useState<string | null>(null);
  const [interviewSaveSuccessTick, setInterviewSaveSuccessTick] = useState(0);
  const interviewTranscriptRef = useRef<Array<{ role: "assistant" | "user"; content: string }>>([]);
  /** 开始面试时的 elapsedSec（用于统计面试用时） */
  const interviewStartElapsedSecRef = useRef<number | null>(null);
  /** 自动暂停：无操作超 3 分钟 */
  const lastUserActivityAtRef = useRef<number>(Date.now());
  /** 每满 25 分钟 +5 EXP 的计数 */
  const focusQuarterAwardRef = useRef<number>(0);
  /** 完成面试奖励只发一次 */
  const interviewExpAwardedRef = useRef(false);
  /** 是否曾有过一次“开始学习”（用于文案：等待 / 已暂停） */
  const [focusEverStarted, setFocusEverStarted] = useState(false);
  /** 与 focusRunning 同步，供 startTimer 幂等判断（避免闭包读到旧值） */
  const focusRunningRef = useRef(false);
  const pokeFocusPetRef = useRef<PokeFocusPetHandle>(null);
  const timeUpTriggeredRef = useRef(false);
  const masteryAchievedRef = useRef(false);
  const masterySavedRef = useRef(false);
  const sessionPageIdRef = useRef<string | null>(null);
  const [masteryAchievedScore, setMasteryAchievedScore] = useState<number | null>(null);
  const [feynmanNote, setFeynmanNote] = useState<FeynmanNote | null>(null);
  const [feynmanNoteLoading, setFeynmanNoteLoading] = useState(false);
  const [feynmanNoteError, setFeynmanNoteError] = useState<string | null>(null);
  const [feynmanNoteSaved, setFeynmanNoteSaved] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [masteryOverlay, setMasteryOverlay] = useState<{
    open: boolean;
    score: number;
  }>({ open: false, score: 0 });
  const petEatTimeoutRef = useRef<number | null>(null);
  const sessionKindRef = useRef<"pomodoro25" | "quick5">("pomodoro25");
  const quick5ActiveRef = useRef(false);
  const quick5StartElapsedSecRef = useRef<number | null>(null);
  const quick5StartMessageCountRef = useRef<number>(0);
  const [quick5Card, setQuick5Card] = useState<{ open: boolean; step: "achieved" | "doneToday" }>({
    open: false,
    step: "achieved",
  });
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const todaySessionOpenRef = useRef<{ startTime: number; mode: TodaySessionMode } | null>(null);
  const learningModeForSessionRef = useRef<TodaySessionMode>("feynman");
  const petBubbleTimeoutRef = useRef<number | null>(null);
  const petLevelUpTimeoutRef = useRef<number | null>(null);

  // Chat
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false);
  /** 费曼语音：browser = Web Speech 实时；cloud = 录音上传 /api/voice */
  const [feynmanVoiceMode, setFeynmanVoiceMode] = useState<"browser" | "cloud" | null>(null);
  const [feynmanVoiceLive, setFeynmanVoiceLive] = useState({ accumulatedFinal: "", interim: "" });
  const [voiceCloudModeBanner, setVoiceCloudModeBanner] = useState<string | null>(null);
  const [voiceLongTranscribeHint, setVoiceLongTranscribeHint] = useState(false);
  const voiceBrowserSessionRef = useRef<BrowserSpeechSession | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceDiscardRef = useRef(false);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceCloudRecordMaxTimerRef = useRef<number | null>(null);
  const userMsgElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeUserMsgId, setActiveUserMsgId] = useState<string | null>(null);
  const inProgressMarkedRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    learningWelcomeMessages(linkedTitle.trim() || (linkedItemId ? "当前资料" : "学习资料"))
  );
  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user" && !m.isError).length,
    [messages]
  );
  const [chatSending, setChatSending] = useState(false);
  const [learningChatModelId, setLearningChatModelId] =
    useState<LearningChatModelId>("gemini-2.5-flash");
  const [chatEngineHint, setChatEngineHint] = useState<string | null>(null);
  const [effectiveChatModelId, setEffectiveChatModelId] =
    useState<LearningChatModelId>("gemini-2.5-flash");
  const learningChatModelLabel = useMemo(
    () =>
      LEARNING_CHAT_MODEL_OPTIONS.find((o) => o.id === learningChatModelId)?.label ??
      learningChatModelId,
    [learningChatModelId]
  );
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    // leaving interview mode resets to config panel (pure frontend)
    if (activeMode !== "interview") setInterviewConfigured(false);
  }, [activeMode]);

  useEffect(() => {
    return () => {
      if (petBubbleTimeoutRef.current) window.clearTimeout(petBubbleTimeoutRef.current);
      if (petLevelUpTimeoutRef.current) window.clearTimeout(petLevelUpTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const all = safeParseTodaySessions(window.sessionStorage.getItem(TODAY_SESSIONS_STORAGE_KEY));
    const todays = all.filter((s) => isSameLocalDay(new Date(s.startTime), now));
    setTodaySessions(todays);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expRaw = Number(window.localStorage.getItem(PET_LS_EXP));
    const lvRaw = Number(window.localStorage.getItem(PET_LS_LEVEL));
    const streakRaw = Number(window.localStorage.getItem(PET_LS_STREAK));
    const exp = Number.isFinite(expRaw) ? Math.max(0, Math.min(99, Math.round(expRaw))) : 0;
    const lv = Number.isFinite(lvRaw) ? Math.max(1, Math.round(lvRaw)) : 1;
    const streak = Number.isFinite(streakRaw) ? Math.max(1, Math.round(streakRaw)) : 1;
    setFeedLevel(exp);
    setPokedexLevel(lv);
    setPetStreak(streak);

    // derive visuals from streak
    if (streak >= 14) setPetEmoji("👑");
    else if (streak >= 7) setPetEmoji("😎");
    else setPetEmoji("🙂");
    if (streak >= 30) setPetBadge("🏆 30 天成就");

    // init localStorage defaults if missing
    try {
      if (!window.localStorage.getItem(PET_LS_LEVEL)) window.localStorage.setItem(PET_LS_LEVEL, String(lv));
      if (!window.localStorage.getItem(PET_LS_EXP)) window.localStorage.setItem(PET_LS_EXP, String(exp));
      if (!window.localStorage.getItem(PET_LS_STREAK)) window.localStorage.setItem(PET_LS_STREAK, String(streak));
    } catch {
      /* ignore */
    }
  }, []);

  const persistTodaySessions = useCallback((next: TodaySession[]) => {
    setTodaySessions(next);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(TODAY_SESSIONS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  function resetInterviewFlow() {
    setInterviewConfigured(false);
    setInterviewReport(null);
    setInterviewReportError(null);
    setInterviewReportLoading(false);
    setInterviewReportSaving(false);
    interviewTranscriptRef.current = [];
    interviewStartElapsedSecRef.current = null;
  }

  function resetFeynmanNoteFlow() {
    masteryAchievedRef.current = false;
    masterySavedRef.current = false;
    sessionPageIdRef.current = null;
    setMasteryAchievedScore(null);
    setFeynmanNote(null);
    setFeynmanNoteLoading(false);
    setFeynmanNoteError(null);
    setFeynmanNoteSaved(false);
  }

  function historyToMessages(history: Array<{ question?: string; userAnswer?: string; aiResponse?: string }>) {
    const out: Array<{ role: "assistant" | "user"; content: string }> = [];
    for (const item of Array.isArray(history) ? history : []) {
      const q = String(item?.question ?? "").trim();
      const a = String(item?.userAnswer ?? "").trim();
      const r = String(item?.aiResponse ?? "").trim();
      if (q) out.push({ role: "assistant", content: q });
      if (a) out.push({ role: "user", content: a });
      if (r) out.push({ role: "assistant", content: r });
    }
    return out;
  }

  async function runInterviewEvaluation(
    input:
      | Array<{ role: "assistant" | "user"; content: string }>
      | Array<{ question?: string; userAnswer?: string; aiResponse?: string }>
  ) {
    const isMessages = Array.isArray(input) && (input[0] as any)?.role;
    const messages = (isMessages ? input : historyToMessages(input as any)) as Array<{
      role: "assistant" | "user";
      content: string;
    }>;
    interviewTranscriptRef.current = messages;
    setInterviewReport(null);
    setInterviewReportError(null);
    setInterviewReportLoading(true);
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isMessages ? { messages } : { interviewHistory: input }),
          messages: isMessages ? messages : undefined,
          outline: outlineTextSource,
          documentContext: documentContext.trim(),
          config: { ...interviewConfig, difficulty: "自动递增" },
        }),
      });
      const data = (await res.json()) as InterviewEvaluation;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInterviewReport(data);
      if (!interviewExpAwardedRef.current) {
        interviewExpAwardedRef.current = true;
        const extra = data.overallScore >= 80 ? 10 : 0;
        celebrateExpRef.current(30 + extra);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setInterviewReportError(`评分生成失败：${msg}`);
    } finally {
      setInterviewReportLoading(false);
    }
  }

  async function saveInterviewReportToNotion() {
    if (!linkedItemId) {
      setToast("未找到关联资料 ID，无法保存到 Notion");
      window.setTimeout(() => setToast(null), 2400);
      return;
    }
    if (!interviewReport) return;

    setInterviewReportSaving(true);
    setInterviewReportError(null);

    const startAt = interviewStartElapsedSecRef.current;
    const deltaSec = startAt != null ? Math.max(0, elapsedSec - startAt) : elapsedSec;
    const durationMinutes = Math.max(1, Math.round(deltaSec / 60));

    const diffLabel = "递进考核";
    const suggested =
      interviewReport.suggestedStatus ||
      (interviewReport.overallScore >= 80
        ? "已完成"
        : interviewReport.overallScore >= 60
          ? "待复习"
          : "进行中");

    try {
      const res = await fetch("/api/interview/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePageId: linkedItemId,
          title: linkedTitle || linkedItem?.title || "学习资料",
          sessionDate: new Date().toISOString().slice(0, 10),
          durationMinutes,
          overallScore: interviewReport.overallScore,
          suggestedStatus: suggested,
          difficulty: diffLabel,
          questions: (interviewReport.questions || []).map((q) => ({
            questionText: q.questionText,
            userAnswer: q.userAnswer,
            score: q.score,
            feedback: q.feedback,
            missedPoints: q.missedPoints,
          })),
          strengths: interviewReport.strengths,
          improvements: interviewReport.improvements,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(typeof (j as any)?.error === "string" ? (j as any).error : `HTTP ${res.status}`);
      }
      setInterviewSaveSuccessTick((x) => x + 1);
      void (async () => {
        try {
          const r = await fetch("/api/knowledge", { cache: "no-store" });
          const data = (await r.json()) as { items?: KnowledgeItem[] };
          if (!r.ok) return;
          const items = Array.isArray(data.items) ? data.items : [];
          setLibraryItems(items);
          if (linkedItemId) {
            const hit = items.find((i) => i.id === linkedItemId) ?? null;
            setLinkedItem(hit);
          }
        } catch {
          /* noop */
        }
      })();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setInterviewReportError(`保存失败：${msg}`);
    } finally {
      setInterviewReportSaving(false);
    }
  }

  useEffect(() => {
    const title = linkedTitle.trim() || (linkedItemId ? "当前资料" : "学习资料");
    setMessages(learningWelcomeMessages(title));
    setVideoRecCollapsed(false);
    // 仅在切换 linkedItemId 时重置；不把 linkedTitle 放进 deps，避免同一条目仅改 URL 标题时清空聊天。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedItemId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = chatTextareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const elapsedMin = Math.floor(elapsedSec / 60);
  const petStage = useMemo(() => {
    if (focusRunning) {
      if (elapsedMin < 5) return "waking";
      if (elapsedMin < 25) return "happy";
      return "rest";
    }
    if (!focusEverStarted) return "idle";
    return "paused";
  }, [elapsedMin, focusEverStarted, focusRunning]);

  const companionStatusLabel = !focusEverStarted
    ? "等待开始学习"
    : focusRunning
      ? "学习中..."
      : "已暂停";

  const timerTextClass =
    petStage === "rest"
      ? "text-amber-200"
      : petStage === "paused" || petStage === "idle"
        ? "text-slate-200"
        : "text-cyan-200";

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

  const celebrateExpRef = useRef<(delta: number, message?: string) => void>(() => {});

  const startTimer = useCallback(() => {
    // Pet streak check (only on first start of the day)
    if (typeof window !== "undefined") {
      const today = new Date();
      const todayStr = yyyyMmDdLocal(today);
      const yesterdayStr = yyyyMmDdLocal(addDaysLocal(today, -1));
      const last = String(window.localStorage.getItem(PET_LS_LAST_DATE) ?? "").trim();
      const prevStreakRaw = Number(window.localStorage.getItem(PET_LS_STREAK));
      const prevStreak = Number.isFinite(prevStreakRaw) ? Math.max(1, Math.round(prevStreakRaw)) : 1;

      if (last !== todayStr) {
        let nextStreak = 1;
        let comeback = false;
        if (last === yesterdayStr) {
          nextStreak = prevStreak + 1;
        } else if (last) {
          // broke streak but no penalty
          nextStreak = 1;
          comeback = true;
        }

        window.localStorage.setItem(PET_LS_LAST_DATE, todayStr);
        window.localStorage.setItem(PET_LS_STREAK, String(nextStreak));
        setPetStreak(nextStreak);

        // milestone visuals + rewards (award only when streak increments today)
        if (nextStreak >= 30) {
          setPetBadge("🏆 30 天成就");
        }
        if (nextStreak >= 14) setPetEmoji("👑");
        else if (nextStreak >= 7) setPetEmoji("😎");
        else setPetEmoji("🙂");

        const popBubble = (text: string) => {
          setPetBubble(text);
          if (petBubbleTimeoutRef.current) window.clearTimeout(petBubbleTimeoutRef.current);
          petBubbleTimeoutRef.current = window.setTimeout(() => setPetBubble(null), 2200);
        };

        if (comeback) {
          popBubble("欢迎回来！我们继续 💪");
        } else if (nextStreak === 3) {
          popBubble("连续 3 天！");
        }

        if (nextStreak === 7) {
          // sunglasses + 20 EXP
          popBubble("连续 7 天！😎 +20 EXP");
          celebrateExpRef.current(20);
        } else if (nextStreak === 14) {
          popBubble("连续 14 天！👑 +50 EXP");
          celebrateExpRef.current(50);
        }
      }
    }

    lastUserActivityAtRef.current = Date.now();
    if (focusRunningRef.current) return;
    focusRunningRef.current = true;
    setFocusEverStarted(true);
    setFocusRunning(true);
    setTimerState("focusing");
  }, []);

  const pauseFocus = useCallback(() => {
    focusRunningRef.current = false;
    setFocusRunning(false);
    setTimerState("idle");
  }, []);

  useEffect(() => {
    focusRunningRef.current = focusRunning;
  }, [focusRunning]);

  // (moved) awardExp / celebrateExp are declared above chat submitters

  const requestSessionEvaluationFromAI = useCallback(
    async (thread: ChatMessage[], learningRole: "feynman" | "interview") => {
      const ctx = documentContext.trim();
      if (!ctx) throw new Error("missing document context");
      const ui = chatThreadToUiMessages(thread);
      ui.push({
        id: nowId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: [
              "请你根据以上对话，评估用户对当前资料的学习进度。",
              "请只输出一个 JSON（不要 Markdown code block），字段如下：",
              '{ "score": number(0-100), "status": "已完成"|"待复习"|"需重学", "feedback": string, "weakPoints": string[] }',
            ].join("\n"),
          },
        ],
      });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: ui,
          documentContext: ctx,
          learningRole,
          model: learningChatModelId,
          stream: false,
        }),
      });
      const raw = await res.text();
      // For debugging in dev: print raw model text
      // eslint-disable-next-line no-console
      console.log("[session] AI raw response:", raw);
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      let text = raw;
      try {
        const j = JSON.parse(raw) as { text?: string };
        if (typeof j.text === "string") text = j.text;
      } catch {
        /* keep raw */
      }
      return parseSessionEvaluationFromText(text);
    },
    [documentContext, learningChatModelId]
  );

  const saveSession = useCallback(
    async (args: { score?: number; reason: "auto" | "manual" | "timeUp" }) => {
      if (args.reason === "manual") pauseFocus();
      if (sessionSaving || masterySavedRef.current) {
        setToast("正在保存学习进度…");
        window.setTimeout(() => setToast(null), 1200);
        return;
      }
      const baseThread = messagesRef.current.filter((m) => !m.isError);
      setSessionSaving(true);
      setToast("正在保存学习进度…");
      window.setTimeout(() => setToast(null), 1200);

      const slowHintId = window.setTimeout(() => {
        setToast("仍在写入 Notion，请稍候…");
        window.setTimeout(() => setToast(null), 2600);
      }, 9000);
      const evalFromAI =
        typeof args.score === "number"
          ? ({ ...DEFAULT_SESSION_EVAL, score: args.score } as SessionEvaluation)
          : await requestSessionEvaluationFromAI(baseThread, activeMode).catch(() => DEFAULT_SESSION_EVAL);
      const score = clampScore(evalFromAI.score);

      masterySavedRef.current = true;
      try {
        const res = await fetch("/api/session/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: linkedItemId,
            title: linkedTitle || linkedItem?.title || "学习会话",
            score,
            status: evalFromAI.status,
            feedback: evalFromAI.feedback,
            weakPoints: evalFromAI.weakPoints,
            reason: args.reason,
            learningRole: activeMode,
            sessionKind: sessionKindRef.current,
            messages: baseThread.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const raw = await res.text();
        if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
        try {
          const j = JSON.parse(raw) as { sessionPageId?: unknown };
          const pid = typeof j.sessionPageId === "string" ? j.sessionPageId.trim() : "";
          if (pid) sessionPageIdRef.current = pid;
        } catch {
          /* ignore */
        }
        setMasteryOverlay({ open: true, score });
        window.setTimeout(() => setMasteryOverlay((v) => ({ ...v, open: false })), 1600);
        setToast(`已保存学习进度（掌握度 ${score}/100）`);
        window.setTimeout(() => setToast(null), 2600);
      } catch (e) {
        masterySavedRef.current = false;
        setToast(e instanceof Error ? e.message : "保存失败");
        window.setTimeout(() => setToast(null), 4200);
      } finally {
        window.clearTimeout(slowHintId);
        setSessionSaving(false);
      }
    },
    [
      activeMode,
      linkedItem?.title,
      linkedItemId,
      linkedTitle,
      pauseFocus,
      requestSessionEvaluationFromAI,
      sessionSaving,
    ]
  );

  const generateFeynmanNote = useCallback(async () => {
    if (feynmanNoteLoading) return;
    const ctx = documentContext.trim();
    if (!ctx) {
      setFeynmanNoteError("缺少 documentContext，无法生成笔记。");
      return;
    }
    const baseThread = messagesRef.current.filter((m) => !m.isError);
    const payload = {
      messages: baseThread.map((m) => ({ role: m.role, content: m.content })),
      documentContext: ctx,
    };
    setFeynmanNoteError(null);
    setFeynmanNoteLoading(true);
    try {
      const res = await fetch("/api/feynman/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; note?: FeynmanNote; error?: string };
      const note = data?.note ?? null;
      if (!res.ok || !note) throw new Error(String(data?.error ?? `HTTP ${res.status}`));
      setFeynmanNote(note);
      setFeynmanNoteSaved(false);
      setToast("费曼笔记已生成");
      window.setTimeout(() => setToast(null), 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setFeynmanNoteError(`笔记生成失败：${msg}`);
    } finally {
      setFeynmanNoteLoading(false);
    }
  }, [documentContext, feynmanNoteLoading]);

  const saveFeynmanNoteToNotion = useCallback(async () => {
    if (!feynmanNote) return;
    const pid = String(sessionPageIdRef.current ?? "").trim();
    if (!pid) {
      setToast("未找到本次学习的 Notion 会话 page_id（请先确保“学习完成/结束学习”已成功写入）。");
      window.setTimeout(() => setToast(null), 2600);
      return;
    }
    if (feynmanNoteSaved) {
      setToast("已保存过费曼笔记");
      window.setTimeout(() => setToast(null), 1200);
      return;
    }
    setFeynmanNoteError(null);
    setFeynmanNoteLoading(true);
    try {
      const res = await fetch("/api/feynman/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPageId: pid, note: feynmanNote }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(String(data?.error ?? `HTTP ${res.status}`));
      setFeynmanNoteSaved(true);
      setToast("已写入 Notion（费曼学习笔记）");
      window.setTimeout(() => setToast(null), 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setFeynmanNoteError(`写入 Notion 失败：${msg}`);
    } finally {
      setFeynmanNoteLoading(false);
    }
  }, [feynmanNote, feynmanNoteSaved]);

  const copyOneLineSummary = useCallback(async () => {
    const text = String(feynmanNote?.oneLineSummary ?? "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast("已复制");
      window.setTimeout(() => setToast(null), 900);
    } catch {
      setToast("复制失败（请检查浏览器权限）");
      window.setTimeout(() => setToast(null), 1400);
    }
  }, [feynmanNote]);

  const runLearningChatStream = useCallback(
    async (
      uiMessages: UIMessage[],
      learningRole: "feynman" | "interview",
      assistantId: string
    ) => {
      let lastText = "";
      const ctx = documentContext.trim();
      setChatEngineHint(null);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: uiMessages,
          documentContext: ctx,
          learningRole,
          model: learningChatModelId,
          stream: true,
        }),
      });
      const engine = (res.headers.get("x-ai-engine") ?? "").trim().toLowerCase();
      if (engine === "deepseek") {
        setEffectiveChatModelId("deepseek-chat");
        if (learningChatModelId !== "deepseek-chat") setLearningChatModelId("deepseek-chat");
        const fallback = (res.headers.get("x-ai-fallback") ?? "").trim();
        const fs = (res.headers.get("x-ai-fallback-status") ?? "").trim();
        const fc = (res.headers.get("x-ai-fallback-code") ?? "").trim();
        const fm = (res.headers.get("x-ai-fallback-message") ?? "").trim();
        const brief =
          fallback === "gemini_quota"
            ? `Gemini 限流（${[fs, fc].filter(Boolean).join(" / ") || "quota"}）：${fm || "请稍后重试"}`
            : "Gemini 请求失败，已自动切换至 DeepSeek 备用引擎。";
        setChatEngineHint(brief);
      } else if (engine === "gemini") {
        setEffectiveChatModelId(learningChatModelId);
      }
      if (!res.ok) {
        const raw = await res.text();
        let detail = raw;
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) detail = j.error.trim();
        } catch {
          /* 保留 raw */
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("empty body");
      const chunkStream = uiMessageChunkReadableFromBody(res.body);
      const messageStream = readUIMessageStream({ stream: chunkStream });
      for await (const uiMsg of messageStream) {
        const t =
          uiMsg.parts?.filter(isTextUIPart).map((p) => p.text).join("") ?? "";
        lastText = t;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: t, streaming: true } : m
          )
        );
      }
      return lastText;
    },
    [documentContext, learningChatModelId]
  );

  // EXP / Focus helpers must be declared before submitLearningChat
  // (moved) awardExp / celebrateExp are declared above submitLearningChat

  const submitLearningChat = useCallback(
    async (thread: ChatMessage[], learningRole: "feynman" | "interview") => {
      const ctx = documentContext.trim();
      if (!ctx) {
        pushAssistantMessage(
          "我这边还没有拿到当前资料的大纲或原文（可能仍在从 Notion 加载，或该条目内容为空）。请先在左侧打开一篇资料后再提问。"
        );
        return;
      }
      startTimer();
      const assistantId = nowId();
      const retryPayload: ChatRetryPayload = { kind: "chat", thread, learningRole };
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      setChatSending(true);
      try {
        const ui = chatThreadToUiMessages(thread);
        const finalText = await runLearningChatStream(ui, learningRole, assistantId);
        const mastery = parseMasteryMarker(finalText);
        const masteryScore = mastery.score;
        if (typeof masteryScore === "number") {
          if (!masteryAchievedRef.current) {
            masteryAchievedRef.current = true;
            const extra = masteryScore >= 80 ? 10 : 0;
            celebrateExpRef.current(20 + extra);
          }
          setMasteryAchievedScore(masteryScore);
          queueMicrotask(() => void saveSession({ score: masteryScore, reason: "auto" }));
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const done = { ...m, streaming: false };
            const cleaned = parseMasteryMarker(done.content).cleanText;
            return !cleaned.trim()
              ? { ...done, content: LEARNING_CHAT_EMPTY_REPLY_HINT }
              : { ...done, content: cleaned };
          })
        );
      } catch (e) {
        setMessages((prev) => {
          const rest = prev.filter((m) => m.id !== assistantId);
          return [
            ...rest,
            {
              id: nowId(),
              role: "assistant",
              content: getFriendlyError(e),
              isError: true,
              retryPayload,
            },
          ];
        });
      } finally {
        setChatSending(false);
      }
    },
    [documentContext, pushAssistantMessage, runLearningChatStream, saveSession, startTimer]
  );

  const submitSyntheticLearningChat = useCallback(
    async (
      baseThread: ChatMessage[],
      syntheticUser: string,
      learningRole: "feynman" | "interview"
    ) => {
      const ctx = documentContext.trim();
      if (!ctx) {
        pushAssistantMessage(
          "我这边还没有拿到当前资料的大纲或原文（可能仍在从 Notion 加载，或该条目内容为空）。请先在左侧打开一篇资料后再试。"
        );
        return;
      }
      startTimer();
      const assistantId = nowId();
      const retryPayload: ChatRetryPayload = {
        kind: "synthetic",
        base: baseThread,
        synthetic: syntheticUser,
        learningRole,
      };
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      setChatSending(true);
      try {
        const ui = [...chatThreadToUiMessages(baseThread)];
        ui.push({
          id: nowId(),
          role: "user",
          parts: [{ type: "text", text: syntheticUser }],
        });
        const finalText = await runLearningChatStream(ui, learningRole, assistantId);
        const mastery = parseMasteryMarker(finalText);
        const masteryScore = mastery.score;
        if (typeof masteryScore === "number") {
          if (!masteryAchievedRef.current) {
            masteryAchievedRef.current = true;
            const extra = masteryScore >= 80 ? 10 : 0;
            celebrateExpRef.current(20 + extra);
          }
          setMasteryAchievedScore(masteryScore);
          queueMicrotask(() => void saveSession({ score: masteryScore, reason: "auto" }));
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const done = { ...m, streaming: false };
            const cleaned = parseMasteryMarker(done.content).cleanText;
            return !cleaned.trim()
              ? { ...done, content: LEARNING_CHAT_EMPTY_REPLY_HINT }
              : { ...done, content: cleaned };
          })
        );
      } catch (e) {
        setMessages((prev) => {
          const rest = prev.filter((m) => m.id !== assistantId);
          return [
            ...rest,
            {
              id: nowId(),
              role: "assistant",
              content: getFriendlyError(e),
              isError: true,
              retryPayload,
            },
          ];
        });
      } finally {
        setChatSending(false);
      }
    },
    [documentContext, pushAssistantMessage, runLearningChatStream, saveSession, startTimer]
  );

  const handleChatRetry = useCallback(
    (errorMessageId: string) => {
      setMessages((prev) => {
        const err = prev.find((x) => x.id === errorMessageId);
        const payload = err?.retryPayload;
        if (!payload) return prev;
        const next = prev.filter((x) => x.id !== errorMessageId);
        queueMicrotask(() => {
          if (payload.kind === "chat") {
            void submitLearningChat(payload.thread, payload.learningRole);
          } else {
            void submitSyntheticLearningChat(
              payload.base,
              payload.synthetic,
              payload.learningRole
            );
          }
        });
        return next;
      });
    },
    [submitLearningChat, submitSyntheticLearningChat]
  );

  // Outline -> Feynman chat linkage (user-visible)
  useEffect(() => {
    if (!selectedTopic) return;
    if (lastSelectedTopicIdRef.current === selectedTopic.id) return;
    lastSelectedTopicIdRef.current = selectedTopic.id;

    const pickedTitle = selectedTopic.title;
    const wasFeynman = activeMode === "feynman";

    // 若当前不在费曼模式：切回费曼（不触发额外“入口引导”消息）
    if (activeMode !== "feynman") {
      resetInterviewFlow();
      setMode("story");
      setActiveMode("feynman");
    }

    setToast(wasFeynman ? `已切换到费曼学习：${pickedTitle}` : "已切换到费曼学习法模式");
    window.setTimeout(() => setToast(null), 2000);

    const base = messagesRef.current.filter((m) => !m.isError);
    const hasUserHistory = base.some((m) => m.role === "user");
    const text = hasUserHistory
      ? `我们换个话题，我想了解「${pickedTitle}」`
      : `我想深入了解「${pickedTitle}」这部分`;
    const userMsg: ChatMessage = { id: nowId(), role: "user", content: text };

    // 先把可见用户消息写入 UI，再触发 AI 回复
    setMessages((prev) => [...prev, userMsg]);
    queueMicrotask(() => {
      void submitLearningChat([...messagesRef.current.filter((m) => !m.isError), userMsg], "feynman");
    });

    // 只触发一次，避免重复
    setSelectedTopic(null);
  }, [activeMode, resetInterviewFlow, submitLearningChat, selectedTopic]);

  const awardExp = useCallback((delta: number) => {
    setFeedLevel((prev) => {
      const total = Math.max(0, prev + delta);
      if (total >= 100) {
        // level up: exp resets to 0
        setPokedexLevel((lv) => {
          const nextLv = lv + 1;
          if (typeof window !== "undefined") window.localStorage.setItem(PET_LS_LEVEL, String(nextLv));
          return nextLv;
        });
        if (typeof window !== "undefined") window.localStorage.setItem(PET_LS_EXP, "0");
        setPetLevelUpBurst(true);
        if (petLevelUpTimeoutRef.current) window.clearTimeout(petLevelUpTimeoutRef.current);
        petLevelUpTimeoutRef.current = window.setTimeout(() => setPetLevelUpBurst(false), 900);
        setPetBubble((v) => v ?? `恭喜升到 Lv.${pokedexLevel + 1}！`);
        if (petBubbleTimeoutRef.current) window.clearTimeout(petBubbleTimeoutRef.current);
        petBubbleTimeoutRef.current = window.setTimeout(() => setPetBubble(null), 2200);
        return 0;
      }
      if (typeof window !== "undefined") window.localStorage.setItem(PET_LS_EXP, String(total));
      return total;
    });
  }, [pokedexLevel]);

  const celebrateExp = useCallback(
    (delta: number, message?: string) => {
      awardExp(delta);
      setTimerState("completed");
      setPetEatBurst(true);
      if (petEatTimeoutRef.current) window.clearTimeout(petEatTimeoutRef.current);
      petEatTimeoutRef.current = window.setTimeout(() => {
        setPetEatBurst(false);
        setTimerState(focusRunning ? "focusing" : "idle");
      }, 800);
      if (message) pushAssistantMessage(message, "petReward");
    },
    [awardExp, focusRunning, pushAssistantMessage]
  );

  useEffect(() => {
    celebrateExpRef.current = celebrateExp;
  }, [celebrateExp]);

  function respondByMode(nextMode: LearningModeKey) {
    const base = messagesRef.current;
    if (nextMode === "story") {
      void submitSyntheticLearningChat(
        base,
        `
<System>
用户操作触发：已选择「费曼学习法」入口。
</System>
<Context>
请严格基于【当前学习文档】推进本轮对话；文档全文已在本次会话的系统提示中提供。
</Context>
<Instructions>
本轮只需落实系统提示中「第一轮：建立基础」里适合当场完成的部分（不必一次跑完全部五轮）：
1. 若用户尚未指定子主题，先从文档中提炼 1 个核心主题并请用户确认。
2. 用 2～4 句完成破冰（约 100～150 字的生活化比喻，初步解释阶段避免专业术语），必须紧扣文档标题与核心论点。
3. 最后提出 1 个与文档直接相关、可先用一句话回答的小问题。
</Instructions>
<Constraints>
- 禁止拿文档未涉及的技术/业务话题当作核心举例（除非该话题在文档中出现）。
- 单次回复不超过 400 字。
- 若信息不足，先说明依据来自文档哪一部分，再谨慎补充。
</Constraints>
`.trim(),
        "feynman"
      );
      return;
    }
    void submitSyntheticLearningChat(
      base,
      `
<System>
用户操作触发：已选择「模拟面试官考核」入口。
</System>
<Context>
请严格基于【当前学习文档】；文档已在系统提示中提供。
</Context>
<Instructions>
请以模拟面试口吻给出第 1 个面试问题：题干尽量短，只考察文档中可能出现的概念；可先一句简短开场白再出题。
</Instructions>
<Constraints>
- 不得编造文档未出现的事实或细节。
- 不要提问文档完全未涉及的主题。
- 单次回复不超过 400 字。
</Constraints>
`.trim(),
      "interview"
    );
  }

  async function syncInProgressStatus() {
    if (!linkedItemId || inProgressMarkedRef.current) return;
    inProgressMarkedRef.current = true;

    // optimistic update for local page state (no global store here)
    setLinkedItem((prev) => (prev ? { ...prev, status: "进行中" } : prev));
    setLibraryItems((prev) =>
      prev.map((it) => (it.id === linkedItemId ? { ...it, status: "进行中" } : it))
    );

    try {
      const res = await fetch("/api/notion/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgePageId: linkedItemId, status: "进行中" }),
      });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(raw || `HTTP ${res.status}`);
      }
    } catch {
      // rollback optimistic update on failure
      inProgressMarkedRef.current = false;
      setLinkedItem((prev) => (prev ? { ...prev, status: prev.status } : prev));
      setLibraryItems((prev) =>
        prev.map((it) => (it.id === linkedItemId ? { ...it, status: it.status } : it))
      );
    }
  }

  async function handleModeSelect(nextMode: LearningModeKey) {
    // 前置同步：先把知识库状态写成“进行中”，成功后再切换 UI
    await syncInProgressStatus();

    setVideoRecCollapsed(true);
    setMode(nextMode);
    setActiveMode(nextMode === "story" ? "feynman" : "interview");
    learningModeForSessionRef.current = nextMode === "story" ? "feynman" : "interview";
    respondByMode(nextMode);
  }

  /** 退出模拟面试官考核，回到费曼学习法 */
  function exitInterviewMode() {
    resetInterviewFlow();
    void handleModeSelect("story");
  }

  function restartFeynmanLearning() {
    const title = linkedTitle.trim() || (linkedItemId ? "当前资料" : "学习资料");
    setMessages(learningWelcomeMessages(title));
    resetFeynmanNoteFlow();
    setToast("已重置本轮费曼学习");
    window.setTimeout(() => setToast(null), 1200);
  }

  function goOutlineNext() {
    setCurrentStep((s) => (s < 4 ? ((s + 1) as OutlineStep) : s));
  }

  function handleOutlineQuiz(answer: "A" | "B") {
    if (answer === "A") {
      setQuizFeedback("correct");
      setMode("interview");
      setActiveMode("interview");
      pushAssistantMessage(
        "恭喜，回答正确！你已经完成今天的最小闭环。右侧已切换到模拟面试官模式。"
      );
      requestAnimationFrame(() => {
        void submitSyntheticLearningChat(
          messagesRef.current,
          `
<System>
用户操作触发：随堂小测答对。
</System>
<Context>
界面已切换到模拟面试模式；请继续只依据【当前学习文档】。
</Context>
<Instructions>
先给一句简短肯定，再给出第 1 个面试问题（题干尽量短）。
</Instructions>
<Constraints>
- 不得编造文档未出现的事实或细节。
- 单次回复不超过 400 字。
</Constraints>
`.trim(),
          "interview"
        );
      });
      return;
    }
    setQuizFeedback("wrong");
    pushAssistantMessage(
      "这题先别急。建议回到左侧大纲对应章节，对照作者的核心结论与论据再想一步。"
    );
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
    setVideoRecCollapsed(true);
    learningModeForSessionRef.current = "peek";
    setTab("outline");
    const randomStep = (Math.floor(Math.random() * 3) + 1) as OutlineStep;
    setCurrentStep(randomStep);
    void submitSyntheticLearningChat(
      messagesRef.current,
      `
<System>
用户操作触发：「只想随便看看」。
</System>
<Context>
请仅从【当前学习文档】中取材；不要引入文档外的主题作为核心内容。
</Context>
<Instructions>
抽取一个可在 1～2 分钟内消化的小点：用 2～5 句话讲清楚，再给 1 句与文档相关的追问；结尾可提示用户回复「我懂 / 我不懂」。
</Instructions>
<Constraints>
- 单次回复不超过 400 字。
- 若某点文档依据较弱，请如实说明。
</Constraints>
`.trim(),
      "feynman"
    );
  }

  function handleStartQuick5() {
    setVideoRecCollapsed(true);
    // Ensure in Feynman mode
    if (activeMode !== "feynman") {
      resetInterviewFlow();
      setMode("story");
      setActiveMode("feynman");
    }
    learningModeForSessionRef.current = "feynman";

    // Start "quick5" session
    sessionKindRef.current = "quick5";
    quick5ActiveRef.current = true;
    quick5StartElapsedSecRef.current = elapsedSec;
    quick5StartMessageCountRef.current = 0;
    setQuick5Card({ open: false, step: "achieved" });

    // Clear the default welcome intro; ask directly
    setMessages([]);
    startTimer();
    pokeFocusPetRef.current?.startTimer();

    const prompt = `
<System>
用户操作触发：「只学 5 分钟」。
</System>
<Context>
请只依据【当前学习文档】。你的任务是：立刻提问（不要自我介绍、不要寒暄）。
</Context>
<Instructions>
请提出 1 个关于当前文档“最核心概念”的简单问题（题干尽量短），方便用户立刻回答。
只输出问题本身，不要解释、不要给答案、不要列清单。
</Instructions>
<Constraints>
- 单次输出不超过 120 字。
- 不得编造文档未出现的事实或细节。
</Constraints>
`.trim();

    requestAnimationFrame(() => {
      void submitSyntheticLearningChat([], prompt, "feynman");
    });
  }

  const quick5Rounds = useMemo(() => {
    const start = quick5StartMessageCountRef.current;
    const slice = messages.slice(start);
    const userCount = slice.filter((m) => m.role === "user" && !m.isError).length;
    const assistantCount = slice.filter(
      (m) => m.role === "assistant" && !m.isError && !m.streaming && String(m.content ?? "").trim()
    ).length;
    return Math.min(userCount, assistantCount);
  }, [messages]);

  const triggerQuick5Achievement = useCallback(() => {
    if (quick5Card.open) return;
    setQuick5Card({ open: true, step: "achieved" });
    quick5ActiveRef.current = false;
    quick5StartElapsedSecRef.current = null;
    pauseFocus();
  }, [pauseFocus, quick5Card.open]);

  useEffect(() => {
    // Track start message count when we first enter quick5 (after messages are cleared).
    if (!quick5ActiveRef.current) return;
    if (quick5StartMessageCountRef.current !== 0) return;
    quick5StartMessageCountRef.current = 0;
  }, [messages.length]);

  useEffect(() => {
    if (!quick5ActiveRef.current) return;
    const start = quick5StartElapsedSecRef.current;
    if (start == null) return;
    const delta = Math.max(0, elapsedSec - start);
    if (delta >= 5 * 60) triggerQuick5Achievement();
  }, [elapsedSec, triggerQuick5Achievement]);

  useEffect(() => {
    if (!quick5ActiveRef.current) return;
    const start = quick5StartElapsedSecRef.current;
    if (start == null) return;
    const delta = Math.max(0, elapsedSec - start);
    if (delta > 5 * 60) return;
    if (quick5Rounds >= 3) triggerQuick5Achievement();
  }, [elapsedSec, quick5Rounds, triggerQuick5Achievement]);

  useEffect(() => {
    if (!focusRunning) return;
    const t = window.setInterval(() => {
      setElapsedSec((s) => {
        const next = s + 1;
        const q = Math.floor(next / (25 * 60));
        if (q > focusQuarterAwardRef.current) {
          focusQuarterAwardRef.current = q;
          celebrateExpRef.current(5);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [focusRunning]);

  useEffect(() => {
    // Track today's sessions: start when focus starts; end when focus stops.
    if (typeof window === "undefined") return;
    const now = Date.now();

    if (focusRunning) {
      if (!todaySessionOpenRef.current) {
        todaySessionOpenRef.current = { startTime: now, mode: learningModeForSessionRef.current };
      }
      return;
    }

    const open = todaySessionOpenRef.current;
    if (!open) return;
    todaySessionOpenRef.current = null;

    const endTime = now;
    if (endTime <= open.startTime) return;

    // Keep only today's sessions; append this one
    const today = new Date();
    const merged = [
      ...todaySessions.filter((s) => isSameLocalDay(new Date(s.startTime), today)),
      { startTime: open.startTime, endTime, mode: open.mode },
    ]
      .filter((s) => s.endTime > s.startTime)
      .sort((a, b) => a.startTime - b.startTime);

    persistTodaySessions(merged);
  }, [focusRunning, persistTodaySessions, todaySessions]);

  useEffect(() => {
    const onClickCap = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const el = t.closest(
        "button,[role='button'],input[type='submit'],input[type='button'],a[href],select"
      );
      if (el) lastUserActivityAtRef.current = Date.now();
    };
    document.addEventListener("click", onClickCap, true);
    const onVis = () => {
      if (document.visibilityState !== "visible") pauseFocus();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => {
      if (!focusRunning) return;
      if (Date.now() - lastUserActivityAtRef.current > 3 * 60 * 1000) {
        pauseFocus();
      }
    }, 5000);
    return () => {
      document.removeEventListener("click", onClickCap, true);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(t);
    };
  }, [focusRunning, pauseFocus]);

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
  }, [messages, chatSending]);

  const userQuestions = useMemo(() => {
    const list = messages
      .filter((m) => m.role === "user" && !m.isError)
      .map((m, idx) => ({
        id: m.id,
        idx: idx + 1,
        preview: firstLinePreview(m.content),
      }));
    return list;
  }, [messages]);

  const scrollToUserQuestion = useCallback((id: string) => {
    const target = userMsgElsRef.current[id];
    const container = chatScrollContainerRef.current;
    if (!target || !container) return;
    setActiveUserMsgId(id);
    // scrollIntoView 会滚动最近的可滚容器；这里容器本身 overflow-auto，符合预期
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const ids = userQuestions.map((q) => q.id);
        if (!ids.length) return;
        const top = container.getBoundingClientRect().top;
        let bestId: string | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const id of ids) {
          const el = userMsgElsRef.current[id];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const d = Math.abs(r.top - top);
          if (d < bestDist) {
            bestDist = d;
            bestId = id;
          }
        }
        if (bestId && bestId !== activeUserMsgId) {
          setActiveUserMsgId(bestId);
        }
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      container.removeEventListener("scroll", onScroll);
    };
  }, [activeUserMsgId, userQuestions]);

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

  function resetTimer() {
    setElapsedSec(0);
    focusQuarterAwardRef.current = 0;
    focusRunningRef.current = false;
    setFocusRunning(false);
    setTimerState("idle");
    setFocusEverStarted(false);
  }

  const rawTextSource = String(sessionRawText || linkedDetail?.rawText || "").replace(
    /\\n/g,
    "\n"
  );

  const coreKeywords = useMemo(() => {
    const kws = Array.isArray(linkedDetail?.coreKeywords) ? linkedDetail?.coreKeywords : [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const k of kws ?? []) {
      const t = String(k ?? "").trim();
      if (!t) continue;
      // 避免过短（例如“的”“与”）导致整段高亮
      if (t.length < 2) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }, [linkedDetail?.coreKeywords]);

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

  const rawDocMarkdownComponents = useMemo(() => {
    const kw = String(rawAutoKeyword ?? "").trim();
    return {
      ...rawMarkdownComponents,
      p(props: React.ComponentProps<"p"> & { node?: unknown }) {
        const { children, className, ...rest } = props;
        const text = textFromReactNode(children).replace(/\s+/g, " ").trim();
        const hit = Boolean(kw && text && text.includes(kw));
        const isFirstHit = hit && !rawAutoParaRef.current;
        return (
          <p
            {...rest}
            ref={(el) => {
              if (isFirstHit) rawAutoParaRef.current = el;
            }}
            className={[
              className || "",
              hit ? "rounded-lg bg-yellow-300/15 px-1.5 py-0.5" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {children}
          </p>
        );
      },
    };
  }, [rawAutoKeyword, rawMarkdownComponents]);

  const locateRawByKeyword = useCallback((kw: string) => {
    const k = String(kw ?? "").trim();
    if (!k) return;
    setTab("raw");
    setRawCollapsed(false);
    rawAutoParaRef.current = null;
    setRawAutoKeyword(k);
    window.setTimeout(() => {
      rawAutoParaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }, []);

  const assistantMarkdownComponents = useMemo(() => {
    return {
      ...rawMarkdownComponents,
      a({
        href,
        children,
        ...props
      }: React.ComponentProps<"a"> & { node?: unknown }) {
        const u = String(href ?? "");
        if (u.startsWith("kw:")) {
          const kw = decodeURIComponent(u.slice("kw:".length));
          return (
            <button
              type="button"
              onClick={() => locateRawByKeyword(kw)}
              className="font-semibold underline decoration-yellow-200/70 decoration-1 underline-offset-2 hover:text-yellow-100"
              {...(props as any)}
            >
              {children}
            </button>
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-cyan-300/60 underline-offset-2 hover:text-cyan-200"
            {...props}
          >
            {children}
          </a>
        );
      },
    };
  }, [locateRawByKeyword, rawMarkdownComponents]);

  useEffect(() => {
    // 每条新的 AI 回复：提取关键词命中 -> 左侧原文临时高亮并滚动到首个命中段落
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && !m.streaming && String(m.content || "").trim());
    if (!lastAssistant) return;
    if (lastProcessedAssistantIdRef.current === lastAssistant.id) return;
    lastProcessedAssistantIdRef.current = lastAssistant.id;

    const content = String(lastAssistant.content || "").replace(/\\n/g, "\n");
    const hits = coreKeywords.filter((k) => content.includes(k));
    setAssistantKwHits((prev) => ({ ...prev, [lastAssistant.id]: hits }));

    rawAutoParaRef.current = null;
    setRawAutoKeyword(hits[0] ?? null);
  }, [messages, coreKeywords]);

  useEffect(() => {
    if (tab !== "raw") return;
    if (!rawAutoKeyword) return;
    if (rawEditMode) return;
    const t = window.setTimeout(() => {
      rawAutoParaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [tab, rawAutoKeyword, rawTextSource, rawEditMode]);

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

  const outlineSectionMap = useMemo(() => {
    const secs = parseOutlineSections(outlineTextSource);
    const m = new Map<string, { title: string; content: string }>();
    for (const s of secs) m.set(s.id, { title: s.title, content: s.content });
    return m;
  }, [outlineTextSource]);

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
    const hBox = { n: 0 };
    const activeTopicId = selectedTopic?.id ?? null;

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
      h1({ children }: { children?: ReactNode }) {
        hBox.n += 1;
        const id = `h-${hBox.n}`;
        const title = String(children ?? "").replace(/\s+/g, " ").trim();
        const active = activeTopicId === id;
        const showDot = outlineOnboardDot && hBox.n === 1;
        const picked = outlineSectionMap.get(id);
        const content = picked?.content ?? "";
        return (
          <button
            type="button"
            title="点击进入费曼对话"
            onClick={() => {
              try {
                window.localStorage.setItem("learning:outlineOnboardDone", "1");
              } catch {}
              setOutlineOnboardDot(false);
              if (active) setSelectedTopic(null);
              else setSelectedTopic({ id, title: title || picked?.title || `章节 ${hBox.n}`, content });
            }}
            className={[
              "group mb-2 w-full rounded-xl border px-3 py-2 text-left text-base font-semibold transition",
              active
                ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.65)]"
                : "border-white/10 bg-black/20 text-slate-100 hover:bg-white/[0.06]",
            ].join(" ")}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2">
                {showDot ? (
                  <span
                    className="relative inline-flex h-2.5 w-2.5 items-center justify-center"
                    aria-hidden
                  >
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-cyan-300/70" />
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-200" />
                  </span>
                ) : null}
                <span className="text-sm opacity-80 transition group-hover:opacity-100" aria-hidden>
                💬
              </span>
              <span className="min-w-0">{children}</span>
              </span>
              <span className="shrink-0 text-xs text-cyan-200/70 transition group-hover:text-cyan-100">
                → 费曼对话
              </span>
            </span>
          </button>
        );
      },
      h2({ children }: { children?: ReactNode }) {
        hBox.n += 1;
        const id = `h-${hBox.n}`;
        const title = String(children ?? "").replace(/\s+/g, " ").trim();
        const active = activeTopicId === id;
        const picked = outlineSectionMap.get(id);
        const content = picked?.content ?? "";
        return (
          <button
            type="button"
            title="点击进入费曼对话"
            onClick={() => {
              try {
                window.localStorage.setItem("learning:outlineOnboardDone", "1");
              } catch {}
              setOutlineOnboardDot(false);
              if (active) setSelectedTopic(null);
              else setSelectedTopic({ id, title: title || picked?.title || `章节 ${hBox.n}`, content });
            }}
            className={[
              "group mb-2 w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
              active
                ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.65)]"
                : "border-white/10 bg-black/20 text-slate-200 hover:bg-white/[0.06]",
            ].join(" ")}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="text-xs opacity-80 transition group-hover:opacity-100" aria-hidden>
                ↳
              </span>
              <span className="min-w-0">{children}</span>
              </span>
              <span className="shrink-0 text-[11px] text-cyan-200/65 transition group-hover:text-cyan-100">
                → 费曼对话
              </span>
            </span>
          </button>
        );
      },
      h3({ children }: { children?: ReactNode }) {
        hBox.n += 1;
        const id = `h-${hBox.n}`;
        const title = String(children ?? "").replace(/\s+/g, " ").trim();
        const active = activeTopicId === id;
        const picked = outlineSectionMap.get(id);
        const content = picked?.content ?? "";
        return (
          <button
            type="button"
            title="点击进入费曼对话"
            onClick={() => {
              try {
                window.localStorage.setItem("learning:outlineOnboardDone", "1");
              } catch {}
              setOutlineOnboardDot(false);
              if (active) setSelectedTopic(null);
              else setSelectedTopic({ id, title: title || picked?.title || `章节 ${hBox.n}`, content });
            }}
            className={[
              "group mb-2 w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
              active
                ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.65)]"
                : "border-white/10 bg-black/20 text-slate-300 hover:bg-white/[0.06]",
            ].join(" ")}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="text-[10px] opacity-70 transition group-hover:opacity-100" aria-hidden>
                •
              </span>
              <span className="min-w-0">{children}</span>
              </span>
              <span className="shrink-0 text-[11px] text-cyan-200/60 transition group-hover:text-cyan-100">
                → 费曼对话
              </span>
            </span>
          </button>
        );
      },
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
  }, [
    outlineFilterQuery,
    outlineMatchIndex,
    outlineOnboardDot,
    outlineSectionMap,
    selectedTopic?.id,
  ]);

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

  function handleLearningChatModelSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value as LearningChatModelId;
    if (!LEARNING_CHAT_MODEL_OPTIONS.some((o) => o.id === nextId)) return;
    if (nextId === learningChatModelId) return;
    setLearningChatModelId(nextId);
    setEffectiveChatModelId(nextId);
    setChatEngineHint(null);
    const label = LEARNING_CHAT_MODEL_OPTIONS.find((o) => o.id === nextId)?.label ?? nextId;
    const toastMsg =
      nextId === "gemini-2.5-flash"
        ? "已切换至 Gemini Flash"
        : nextId === "deepseek-chat"
          ? "已切换至 DeepSeek"
          : `已切换至 ${label}`;
    setToast(toastMsg);
    window.setTimeout(() => setToast(null), 1500);
  }

  function clearVoiceCloudRecordMaxTimer() {
    if (voiceCloudRecordMaxTimerRef.current != null) {
      window.clearTimeout(voiceCloudRecordMaxTimerRef.current);
      voiceCloudRecordMaxTimerRef.current = null;
    }
  }

  function cancelVoiceSession() {
    if (voiceBrowserSessionRef.current) {
      try {
        voiceBrowserSessionRef.current.stop();
      } catch {
        /* noop */
      }
      voiceBrowserSessionRef.current = null;
      setFeynmanVoiceMode(null);
      setFeynmanVoiceLive({ accumulatedFinal: "", interim: "" });
      setIsRecording(false);
      return;
    }
    const rec = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;
    if (!rec && !stream) return;

    clearVoiceCloudRecordMaxTimer();
    setVoiceCloudModeBanner(null);
    voiceDiscardRef.current = true;
    if (rec && (rec.state === "recording" || rec.state === "paused")) {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      return;
    }
    stream?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    voiceChunksRef.current = [];
    setIsRecording(false);
    voiceDiscardRef.current = false;
  }

  function sendMessage() {
    cancelVoiceSession();

    const text = input.trim();
    if (chatSending) return;
    if (!text) {
      setChatEmptySendHint("不能发送空字符");
      window.setTimeout(() => setChatEmptySendHint(null), 2200);
      return;
    }
    lastUserActivityAtRef.current = Date.now();
    pokeFocusPetRef.current?.startTimer();
    // first question: best-effort sync in-progress status (do not block sending)
    void syncInProgressStatus();

    const userMsg: ChatMessage = { id: nowId(), role: "user", content: text };
    const nextThread = [...messages, userMsg];
    setMessages(nextThread);
    setInput("");
    void submitLearningChat(nextThread, mode === "story" ? "feynman" : "interview");
  }

  const startFeynmanCloudRecording = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsRecording(false);
      setFeynmanVoiceMode(null);
      setVoiceCloudModeBanner(null);
      setToast("当前浏览器不支持麦克风录制");
      window.setTimeout(() => setToast(null), 3200);
      return false;
    }
    if (typeof MediaRecorder === "undefined") {
      setIsRecording(false);
      setFeynmanVoiceMode(null);
      setVoiceCloudModeBanner(null);
      setToast("当前浏览器不支持 MediaRecorder");
      window.setTimeout(() => setToast(null), 3200);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = createOptimizedVoiceMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      const recordedMime = recorder.mimeType || "audio/webm";

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        clearVoiceCloudRecordMaxTimer();
        voiceChunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setFeynmanVoiceMode(null);
        setVoiceCloudModeBanner(null);
        setToast("语音识别失败，请直接输入文字");
        window.setTimeout(() => setToast(null), 4200);
      };

      recorder.onstop = async () => {
        clearVoiceCloudRecordMaxTimer();
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setFeynmanVoiceMode(null);
        setVoiceCloudModeBanner(null);

        const discarded = voiceDiscardRef.current;
        voiceDiscardRef.current = false;

        const blob = new Blob(voiceChunksRef.current, { type: recordedMime });
        voiceChunksRef.current = [];

        if (discarded || blob.size === 0) {
          return;
        }

        setIsVoiceTranscribing(true);
        setVoiceLongTranscribeHint(blob.size > VOICE_UPLOAD_LARGE_BYTES);
        try {
          const fd = new FormData();
          const ext = recordedMime.includes("webm")
            ? "webm"
            : recordedMime.includes("ogg")
              ? "ogg"
              : recordedMime.includes("mp4") || recordedMime.includes("m4a")
                ? "m4a"
                : "audio";
          fd.append("audio", blob, `clip.${ext}`);

          const res = await fetch("/api/voice", { method: "POST", body: fd });
          const data = (await res.json()) as { text?: string; error?: string };

          if (!res.ok || typeof data.text !== "string" || !data.text.trim()) {
            setToast("语音识别失败，请直接输入文字");
            window.setTimeout(() => setToast(null), 4200);
            return;
          }
          setInput(data.text.trim());
        } catch {
          setToast("语音识别失败，请直接输入文字");
          window.setTimeout(() => setToast(null), 4200);
        } finally {
          setIsVoiceTranscribing(false);
          setVoiceLongTranscribeHint(false);
        }
      };

      voiceDiscardRef.current = false;
      setVoiceCloudModeBanner("语音识别已切换为云端模式（录音结束后识别）");
      setInput("");
      recorder.start(250);
      voiceCloudRecordMaxTimerRef.current = window.setTimeout(() => {
        voiceCloudRecordMaxTimerRef.current = null;
        const r = mediaRecorderRef.current;
        if (r?.state === "recording") {
          try {
            r.stop();
          } catch {
            /* noop */
          }
        }
      }, CLOUD_VOICE_RECORDING_MAX_MS);
      setFeynmanVoiceMode("cloud");
      setIsRecording(true);
      return true;
    } catch (e) {
      setIsRecording(false);
      setFeynmanVoiceMode(null);
      setVoiceCloudModeBanner(null);
      if (
        e instanceof DOMException &&
        (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")
      ) {
        window.alert("请允许麦克风权限后重试");
        return false;
      }
      setToast("无法启动麦克风，请直接输入文字");
      window.setTimeout(() => setToast(null), 4200);
      return false;
    }
  }, []);

  const stopVoiceRecording = useCallback(() => {
    if (voiceBrowserSessionRef.current) {
      const snap = voiceBrowserSessionRef.current.getSnapshot();
      const full = (snap.accumulatedFinal + snap.interim).trim();
      try {
        voiceBrowserSessionRef.current.stop();
      } catch {
        /* noop */
      }
      voiceBrowserSessionRef.current = null;
      setFeynmanVoiceMode(null);
      setFeynmanVoiceLive({ accumulatedFinal: "", interim: "" });
      setVoiceCloudModeBanner(null);
      setIsRecording(false);
      if (full) setInput(full);
      return;
    }
    clearVoiceCloudRecordMaxTimer();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (isBrowserSpeechRecognitionSupported()) {
      setFeynmanVoiceLive({ accumulatedFinal: "", interim: "" });
      const session = createBrowserSpeechSession({
        lang: "zh-CN",
        onUpdate: (snap) => setFeynmanVoiceLive(snap),
        onError: (code) => {
          try {
            voiceBrowserSessionRef.current?.stop();
          } catch {
            /* noop */
          }
          voiceBrowserSessionRef.current = null;

          if (shouldFallbackSpeechRecognitionToCloud(code)) {
            setFeynmanVoiceLive({ accumulatedFinal: "", interim: "" });
            setFeynmanVoiceMode("cloud");
            setVoiceCloudModeBanner("语音识别已切换为云端模式（录音结束后识别）");
            setToast("实时识别不可用，已自动切换云端录音，请继续说");
            window.setTimeout(() => setToast(null), 3200);
            void startFeynmanCloudRecording().then(() => {
              /* 失败时 startFeynmanCloudRecording 内已收齐 state */
            });
            return;
          }

          setToast(speechRecognitionErrorMessage(code));
          window.setTimeout(() => setToast(null), 6200);
          setFeynmanVoiceMode(null);
          setFeynmanVoiceLive({ accumulatedFinal: "", interim: "" });
          setIsRecording(false);
        },
      });
      if (session) {
        voiceBrowserSessionRef.current = session;
        setFeynmanVoiceMode("browser");
        setVoiceCloudModeBanner(null);
        setInput("");
        setIsRecording(true);
        return;
      }
    }

    await startFeynmanCloudRecording();
  }, [startFeynmanCloudRecording]);

  const toggleVoiceInput = useCallback(async () => {
    if (chatSending || isVoiceTranscribing) return;
    if (isRecording) {
      stopVoiceRecording();
      return;
    }
    await startVoiceRecording();
  }, [chatSending, isRecording, isVoiceTranscribing, startVoiceRecording, stopVoiceRecording]);

  useEffect(() => {
    return () => {
      clearVoiceCloudRecordMaxTimer();
      voiceDiscardRef.current = true;
      try {
        voiceBrowserSessionRef.current?.stop();
      } catch {
        /* noop */
      }
      voiceBrowserSessionRef.current = null;
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    };
  }, []);

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

  const subtleBreath =
    focusRunning
      ? "ring-1 ring-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_0_28px_rgba(34,211,238,0.07)]"
      : "ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_18px_rgba(0,0,0,0.25)]";

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
              onPickTopic={(t) => setSelectedTopic(t)}
              activeTopicTitle={selectedTopic?.title ?? null}
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
      {masteryOverlay.open ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-3xl border border-emerald-500/25 bg-neutral-950/70 p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur">
            <div className="text-xs font-semibold tracking-wide text-emerald-300">
              学习完成
            </div>
            <div className="mt-2 text-3xl font-extrabold text-emerald-100">
              {masteryOverlay.score}/100
            </div>
            <div className="mt-2 text-sm text-slate-300">
              掌握度评分已保存
            </div>
          </div>
        </div>
      ) : null}
      {quick5Card.open ? (
        <div className="fixed inset-0 z-[86] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-purple-500/25 bg-neutral-950/75 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur">
            {quick5Card.step === "achieved" ? (
              <>
                <div className="text-xs font-semibold tracking-wide text-purple-300">
                  Quick5 · Achievement
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-100">
                  今日最小任务已完成！
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  你已经完成了一个可交付的学习闭环。接下来你想怎么做？
                </div>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuick5Card({ open: false, step: "achieved" });
                      sessionKindRef.current = "pomodoro25";
                      startTimer();
                      pokeFocusPetRef.current?.startTimer();
                    }}
                    className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
                  >
                    继续学习
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pauseFocus();
                      setQuick5Card({ open: true, step: "doneToday" });
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    今天到此为止
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold tracking-wide text-slate-400">
                  今天到此为止
                </div>
                <div className="mt-3 text-lg font-semibold text-slate-100">
                  完成比完美更重要，明天见！
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setQuick5Card({ open: false, step: "achieved" })}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    关闭
                  </button>
                </div>
              </>
            )}
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

        @keyframes quick5PulseBorder {
          0% {
            box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.18), 0 0 0 0 rgba(34, 211, 238, 0);
          }
          60% {
            box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.14), 0 0 0 8px rgba(34, 211, 238, 0.06);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.18), 0 0 0 0 rgba(34, 211, 238, 0);
          }
        }

        .quick5-pulse-border {
          animation: quick5PulseBorder 2.8s ease-in-out infinite;
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
                onClick={() => pauseFocus()}
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

        <div className="flex min-h-0 flex-1">
          {/* Left: Reader / Workspace */}
          <div className="w-1/2 min-w-0 border-r border-white/5 bg-neutral-900/25">
            <div className="flex h-full min-h-0 flex-col">
              {/* Title */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
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
                                linkedDetail?.title || linkedItem?.title || linkedTitle || "当前资料"
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
                                linkedDetail?.title || linkedItem?.title || linkedTitle || "当前资料"
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
                                linkedDetail?.title || linkedItem?.title || linkedTitle || "当前资料"
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
                        </>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="hidden shrink-0 items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 md:inline-flex"
                  >
                    <span className="text-base leading-none">+</span> 添加新资料
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-4 px-5 py-3">
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

                <div className="ml-auto hidden text-xs text-slate-500 md:block">
                  {tab === "raw"
                    ? "逐段阅读 + 记录要点"
                    : tab === "outline"
                      ? "结构化复盘 + 快速回忆"
                      : tab === "diagram"
                        ? "用图把核心逻辑串起来"
                        : "管理资料 + NotebookLM 模式整理"}
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
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-200">正在从 Notion 同步资料原文</span>
                              <span className="flex items-center gap-1" aria-hidden>
                                <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:0ms]" />
                                <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:150ms]" />
                                <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:300ms]" />
                              </span>
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/10" />
                              <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/10" />
                            </div>
                          </div>
                        ) : linkedDetailError ? (
                          <div className="text-sm text-rose-200">同步失败：{linkedDetailError}</div>
                        ) : (sessionRawText || linkedDetail?.rawText) ? (
                          <>
                            <div className="sticky top-0 z-30 -mx-4 mb-3 rounded-xl border border-white/10 bg-black/45 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
                              <div className="flex flex-col gap-2">
                                {/* 第一行：仅筛选 */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                                  <span className="shrink-0 text-[11px] font-mono text-slate-400">
                                    筛选
                                  </span>
                                  <input
                                    value={rawFilterQuery}
                                    onChange={(e) => setRawFilterQuery(e.target.value)}
                                    placeholder="输入关键词（高亮匹配并可跳转）"
                                    className="min-w-[min(100%,220px)] flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                                  />
                                  {rawFilterQuery.trim() ? (
                                    <button
                                      type="button"
                                      onClick={() => setRawFilterQuery("")}
                                      className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    >
                                      清空
                                    </button>
                                  ) : null}

                                  {rawFilterQuery.trim() ? (
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
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

                                {/* 第二行：编辑 / 保存 / 取消（不与筛选同一行） */}
                                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                                  {!rawEditMode ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRawEditMode(true);
                                        setRawDraftText(rawTextSource);
                                        setRawAnnotEnabled(false);
                                        setRawCollapsed(false);
                                      }}
                                      disabled={
                                        !linkedItemId ||
                                        !rawTextSource.trim() ||
                                        linkedDetailLoading ||
                                        rawEditSaving
                                      }
                                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-500/45 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      编辑原文
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={saveRawTextToNotion}
                                        disabled={!linkedItemId || rawEditSaving}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        {rawEditSaving ? "保存中…" : "保存到 Notion"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRawEditMode(false);
                                          setRawDraftText("");
                                        }}
                                        disabled={rawEditSaving}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-600/25 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-600/40 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        取消
                                      </button>
                                    </>
                                  )}
                                </div>

                                {rawEditMode ? (
                                  <div className="text-[11px] text-slate-500">
                                    编辑模式：修改正文后点「保存到 Notion」写回。
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
                                rawEditMode
                                  ? "min-h-[520px]"
                                  : rawCollapsed
                                    ? "max-h-[420px] overflow-hidden"
                                    : "",
                              ].join(" ")}
                              ref={rawAnnotWrapRef}
                            >
                              {rawEditMode ? (
                                <div className="relative z-20">
                                  <textarea
                                    value={rawDraftText}
                                    onChange={(e) => setRawDraftText(e.target.value)}
                                    spellCheck={false}
                                    className="w-full resize-none rounded-xl border border-white/10 bg-neutral-900/30 p-4 font-mono text-sm leading-relaxed text-slate-100 outline-none focus:border-cyan-500/40"
                                    style={{ minHeight: 440 }}
                                  />
                                </div>
                              ) : (
                                <>
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
                                        components={rawDocMarkdownComponents}
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
                                </>
                              )}
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
                              {outlineHintOpen ? (
                                <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
                                  <div className="min-w-0 leading-relaxed">
                                    💡 点击任意章节标题，可直接进入该知识点的费曼学习对话
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.06]"
                                    onClick={() => {
                                      setOutlineHintOpen(false);
                                      try {
                                        window.localStorage.setItem("learning:outlineHintDismissed", "1");
                                      } catch {}
                                    }}
                                    aria-label="关闭提示"
                                  >
                                    关闭
                                  </button>
                                </div>
                              ) : null}
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
                              {selectedTopic?.title ? (
                                <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
                                  已选择章节：<span className="font-semibold">{selectedTopic.title}</span>
                                </div>
                              ) : null}
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
                              onPickTopic={(t) => setSelectedTopic(t)}
                              activeTopicTitle={selectedTopic?.title ?? null}
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
          <div className="w-1/2 min-w-0 bg-neutral-950/40">
            <div className="flex h-full min-h-0 flex-col">
              {/* Mode switch + Pet card */}
              <div className="relative border-b border-white/5 px-5 py-3">
                <div className="mt-3 flex items-stretch gap-3">
                  {/* Left 65%: modes */}
                  {!(
                    activeMode === "interview" &&
                    interviewConfigured &&
                    interviewReport &&
                    !interviewReportLoading
                  ) ? (
                    <div className="min-w-0 flex-[0_0_65%]">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                        <button
                          type="button"
                          disabled={chatSending}
                          onClick={() => void handleModeSelect("story")}
                          className={[
                            "flex h-9 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                            activeMode === "feynman"
                              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                              : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-500/20 hover:bg-white/[0.05]",
                          ].join(" ")}
                          aria-pressed={activeMode === "feynman"}
                        >
                          <Lightbulb className="h-4 w-2" />
                          费曼学习法
                        </button>
                        <button
                          type="button"
                          disabled={chatSending}
                          onClick={() => void handleModeSelect("interview")}
                          className={[
                            "flex h-9 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                            activeMode === "interview"
                              ? "border-purple-500/30 bg-purple-500/10 text-purple-200"
                              : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-purple-500/20 hover:bg-white/[0.05]",
                          ].join(" ")}
                          aria-pressed={activeMode === "interview"}
                        >
                          <BriefcaseBusiness className="h-4 w-4" />
                          模拟面试官考核
                        </button>
                        <button
                          type="button"
                          disabled={chatSending}
                          onClick={handleRandomPeek}
                          className="flex h-9 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/15 to-white/[0.03] px-3 text-[13px] font-semibold text-cyan-100 transition hover:from-cyan-500/20 hover:to-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Shuffle className="h-4 w-4" />
                          只想随便看看
                        </button>
                        <button
                          type="button"
                          disabled={chatSending}
                          onClick={handleStartQuick5}
                          className="quick5-pulse-border relative flex h-9 w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-500/18 to-white/[0.03] px-3 text-[13px] font-semibold text-purple-100 transition hover:from-purple-500/22 hover:to-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Hourglass className="h-4 w-4" />
                          只学5分钟·最轻松的开始
                        </button>

                        {/* Model selector: under Quick5 (right column) */}
                        <div className="hidden sm:flex col-start-2 items-center justify-end gap-3 pt-2">
                          <div className="text-[15px] font-mono font-semibold text-slate-400">
                            Model
                          </div>
                          <select
                            value={learningChatModelId}
                            disabled={chatSending}
                            onChange={handleLearningChatModelSelectChange}
                            className="h-8 w-[260px] cursor-pointer rounded-xl border border-white/10 bg-neutral-950/60 px-3 text-[13px] font-semibold text-slate-100 outline-none transition hover:border-white/15 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="选择对话模型"
                          >
                            {LEARNING_CHAT_MODEL_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Right 35%: PokeFocusPet */}
                  <div className="min-w-0 flex-[0_0_35%]">
                    <PokeFocusPet
                      floating={false}
                      compact
                      containerClassName="h-full"
                      ref={pokeFocusPetRef}
                      petSpriteUrl={getPetSprite(selectedPetId, timerState)}
                      petName={PET_NAMES[selectedPetId]}
                      focusRunning={focusRunning}
                      petEatBurst={petEatBurst}
                      petLevelUpBurst={petLevelUpBurst}
                      petBubble={petBubble}
                      petStreak={petStreak}
                      petEmoji={petEmoji}
                      petBadge={petBadge}
                      petStage={petStage}
                      subtleBreathClass={subtleBreath}
                      timerTextClass={timerTextClass}
                      elapsedMin={elapsedMin}
                      pokedexLevel={pokedexLevel}
                      feedLevel={feedLevel}
                      companionStatus={companionStatusLabel}
                      onReset={resetTimer}
                      onStartTimer={startTimer}
                      todaySessions={todaySessions}
                      elapsedSec={elapsedSec}
                      userMessageCount={userMessageCount}
                      onSessionComplete={() => celebrateExpRef.current(5)}
                    />
                  </div>
                </div>
              </div>

              {activeMode === "interview" ? (
                /* Interview mode: config -> dialog */
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {!interviewConfigured ? (
                    <InterviewConfigPanel
                      value={interviewConfig}
                      onChange={setInterviewConfig}
                      onStart={() => {
                        interviewStartElapsedSecRef.current = elapsedSec;
                        pokeFocusPetRef.current?.startTimer();
                        setInterviewReport(null);
                        setInterviewReportError(null);
                        setInterviewConfigured(true);
                      }}
                      disabled={chatSending}
                    />
                  ) : interviewReportLoading ? (
                    <div className="flex h-full w-full items-center justify-center bg-[#0f1115] p-6 text-slate-100">
                      <div className="w-full max-w-[720px] rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
                        <div className="text-xs font-mono text-slate-400">Interview · Report</div>
                        <div className="mt-2 text-lg font-semibold text-slate-100">
                          面试官正在生成评分报告…
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-2 text-slate-300">
                          <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:300ms]" />
                        </div>
                        {interviewReportError ? (
                          <div className="mt-4 text-sm text-rose-200">{interviewReportError}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : interviewReport ? (
                    <InterviewReportCard
                      report={interviewReport}
                      saving={interviewReportSaving}
                      saveSuccessTick={interviewSaveSuccessTick}
                      onSaveToNotion={() => void saveInterviewReportToNotion()}
                      onReconfigure={() => resetInterviewFlow()}
                      onReInterview={() => resetInterviewFlow()}
                      onBackToLearning={() => exitInterviewMode()}
                    />
                  ) : interviewConfig.answerMode === "text" ? (
                    <InterviewTextUI
                      config={interviewConfig}
                      onBackToConfig={() => setInterviewConfigured(false)}
                      onGenerateReport={(msgs) => void runInterviewEvaluation(msgs)}
                    />
                  ) : (
                    <InterviewVoiceUI
                      totalInterviewQuestions={interviewConfig.questionCount}
                      documentContent={documentContext}
                      onGenerateReport={(history) => runInterviewEvaluation(history)}
                    />
                  )}
                </div>
              ) : (
                <>
                  {/* Chat stream */}
                  <div className="flex min-h-0 flex-1">
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
                          {m.isError ? (
                            <div className="flex max-w-[85%] flex-col gap-2">
                              <div className="whitespace-pre-wrap rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm leading-relaxed text-rose-100 shadow-sm">
                                {m.content}
                              </div>
                              {m.retryPayload ? (
                                <button
                                  type="button"
                                  onClick={() => handleChatRetry(m.id)}
                                  className="self-start rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                                >
                                  重试
                                </button>
                              ) : null}
                            </div>
                          ) : (
                          <div
                            ref={(el) => {
                              if (m.role === "user") userMsgElsRef.current[m.id] = el;
                            }}
                            className={[
                              "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                              m.role === "assistant"
                                ? "border-white/10 bg-white/[0.03] text-slate-100"
                                : "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
                            ].join(" ")}
                          >
                            {m.role === "assistant" ? (
                              <>
                                {m.streaming && !m.content.trim() ? (
                                  <div
                                    className="flex items-center gap-1 p-3 text-current"
                                    aria-hidden
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full bg-current motion-safe:animate-bounce [animation-delay:0ms]"
                                    />
                                    <span
                                      className="h-2 w-2 rounded-full bg-current motion-safe:animate-bounce [animation-delay:150ms]"
                                    />
                                    <span
                                      className="h-2 w-2 rounded-full bg-current motion-safe:animate-bounce [animation-delay:300ms]"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className={[
                                      "prose prose-invert prose-sm max-w-none break-words text-slate-100",
                                      "prose-p:my-2 prose-p:first:mt-0 prose-p:last:mb-0",
                                      "prose-headings:my-2 prose-headings:text-slate-100",
                                      "prose-a:text-cyan-300 prose-strong:text-slate-100",
                                      "prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:text-cyan-200",
                                      "prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10",
                                      "prose-li:marker:text-slate-500 prose-blockquote:border-white/20 prose-blockquote:text-slate-300",
                                      "prose-table:text-xs prose-th:border prose-th:border-white/15 prose-td:border prose-td:border-white/10",
                                    ].join(" ")}
                                  >
                                    <ReactMarkdown
                                      remarkPlugins={[
                                        remarkGfm,
                                        remarkKeywordLinker(assistantKwHits[m.id] ?? []),
                                      ]}
                                      components={assistantMarkdownComponents}
                                    >
                                      {String(m.content)
                                        .replace(/\\n/g, "\n")
                                        .trimEnd()}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="whitespace-pre-wrap break-words text-cyan-100">
                                {m.content}
                              </div>
                            )}
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
                              videoRecCollapsed ? (
                                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                        <Video className="h-4 w-4 text-cyan-300" />
                                        <span>相关视频推荐</span>
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">已折叠（点击展开查看推荐）</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setVideoRecCollapsed(false)}
                                      className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                                    >
                                      展开
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <RecommendedVideoCard
                                  videos={recommendedVideos}
                                  onCollapse={() => setVideoRecCollapsed(true)}
                                />
                              )
                            ) : null}
                          </div>
                          )}
                        </div>
                      ))}

                      {activeMode === "feynman" && typeof masteryAchievedScore === "number" ? (
                        <div className="mt-2 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_30px_90px_rgba(0,0,0,0.55)]">
                          <div className="text-xs font-semibold tracking-wide text-emerald-300">
                            学习完成！
                          </div>
                          <div className="mt-2 text-lg font-semibold text-emerald-100">
                            掌握度评分：{masteryAchievedScore}/100
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            下面会基于你在对话中<strong>自己说出来的理解</strong>整理成费曼笔记。
                          </div>

                          {feynmanNoteError ? (
                            <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                              {feynmanNoteError}
                            </div>
                          ) : null}

                          {!feynmanNote ? (
                            <button
                              type="button"
                              onClick={() => void generateFeynmanNote()}
                              disabled={feynmanNoteLoading}
                              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              {feynmanNoteLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  正在整理你的学习笔记...
                                </>
                              ) : (
                                "生成费曼笔记"
                              )}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {activeMode === "feynman" && feynmanNote ? (
                        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.60)]">
                          <div className="text-xs font-mono text-slate-400">Feynman · Note</div>
                          <div className="mt-1 text-xl font-semibold text-slate-100">费曼笔记</div>

                          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-5 py-4">
                            <div className="text-xs font-mono text-slate-500">核心概念</div>
                            <div className="mt-2 text-lg font-semibold text-slate-100">{feynmanNote.coreConcept}</div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="text-xs font-mono text-slate-500">最佳类比</div>
                            <div className="mt-2 border-l-2 border-cyan-500/40 pl-4 whitespace-pre-wrap text-sm text-slate-200">
                              {feynmanNote.bestAnalogy || "（无）"}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                              <div className="text-xs font-mono text-slate-500">关键原理</div>
                              {Array.isArray(feynmanNote.keyPrinciples) && feynmanNote.keyPrinciples.length ? (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                                  {feynmanNote.keyPrinciples.slice(0, 6).map((p, i) => (
                                    <li key={`kp-${i}`}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-2 text-sm text-slate-400">（无）</div>
                              )}
                            </div>
                            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4">
                              <div className="text-xs font-mono text-rose-200/90">常见误解</div>
                              {Array.isArray(feynmanNote.commonMisconceptions) &&
                              feynmanNote.commonMisconceptions.length ? (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-100">
                                  {feynmanNote.commonMisconceptions.slice(0, 6).map((p, i) => (
                                    <li key={`cm-${i}`}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-2 text-sm text-rose-100/80">（无）</div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
                            <div className="text-xs font-mono text-emerald-200/90">你的理解亮点</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-50/90">
                              {feynmanNote.userInsights}
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
                            <div className="text-xs font-mono text-amber-200/90">薄弱环节</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-amber-50/90">
                              {feynmanNote.weakPoints}
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-mono text-slate-500">一句话总结（可复制）</div>
                              <button
                                type="button"
                                onClick={() => void copyOneLineSummary()}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                                复制
                              </button>
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                              {feynmanNote.oneLineSummary}
                            </div>
                          </div>

                          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => void saveFeynmanNoteToNotion()}
                              disabled={feynmanNoteLoading || feynmanNoteSaved}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              {feynmanNoteLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  保存中…
                                </>
                              ) : feynmanNoteSaved ? (
                                "已保存到 Notion"
                              ) : (
                                "保存到 Notion"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={restartFeynmanLearning}
                              disabled={feynmanNoteLoading}
                              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              重新学习
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleModeSelect("interview")}
                              disabled={feynmanNoteLoading || chatSending}
                              className="inline-flex w-full items-center justify-center rounded-2xl border border-purple-500/25 bg-purple-500/10 px-5 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              进入面试考核
                            </button>
                          </div>
                        </div>
                      ) : null}
                      </div>
                    </div>

                    {/* Right rail: question progress */}
                    <div className="hidden min-h-0 w-44 shrink-0 border-l border-white/5 bg-neutral-950/25 px-3 pb-6 pt-3 md:block">
                      <div className="sticky top-3">
                        <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400">
                          你的问题
                        </div>
                        <div className="max-h-[calc(100vh-320px)] overflow-auto pr-1 scrollbar-hidden">
                          {userQuestions.length ? (
                            <div className="space-y-1.5">
                              {userQuestions.map((q) => (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => scrollToUserQuestion(q.id)}
                                  className={[
                                    "group flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition",
                                    q.id === activeUserMsgId
                                      ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-100"
                                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                                  ].join(" ")}
                                  title={q.preview}
                                >
                                  <span
                                    className={[
                                      "mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-mono",
                                      q.id === activeUserMsgId
                                        ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-200"
                                        : "border-white/10 bg-black/20 text-slate-400",
                                    ].join(" ")}
                                  >
                                    {q.idx}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{q.preview}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2 text-[11px] text-slate-500">
                              还没有问题
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input */}
                  <div className="border-t border-white/5 bg-neutral-950/35 px-5 py-4">
                    {voiceCloudModeBanner ? (
                      <div className="mb-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                        {voiceCloudModeBanner}
                      </div>
                    ) : null}
                    {chatEngineHint ? (
                      <div className="mb-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                        {chatEngineHint}
                      </div>
                    ) : null}
                    {isVoiceTranscribing && voiceLongTranscribeHint ? (
                      <div className="mb-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100/90">
                        录音较长，识别中…
                      </div>
                    ) : null}
                    {isRecording && feynmanVoiceMode === "browser" ? (
                      <div className="mb-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                        <div className="text-[11px] font-mono text-cyan-200/70">实时语音识别</div>
                        <div className="mt-1 min-h-[2.5rem] whitespace-pre-wrap break-words text-sm leading-relaxed">
                          <span className="text-slate-100">{feynmanVoiceLive.accumulatedFinal}</span>
                          <span className="text-slate-500 italic">{feynmanVoiceLive.interim}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">再次点击麦克风结束并填入输入框</div>
                      </div>
                    ) : isRecording && feynmanVoiceMode === "cloud" ? (
                      <div className="mb-2 rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-2 text-xs text-slate-300">
                        云端录音中（最长 60 秒，约 16kbps）。再次点击麦克风结束并将音频上传识别。
                      </div>
                    ) : null}
                    <div className="flex items-end gap-3">
                      <div className="relative min-w-0 flex-1">
                        <textarea
                          ref={chatTextareaRef}
                          value={input}
                          onChange={(e) => {
                            setInput(e.target.value);
                            if (chatEmptySendHint) setChatEmptySendHint(null);
                          }}
                          disabled={chatSending || isRecording || isVoiceTranscribing}
                          rows={1}
                          placeholder={`针对《${topicTitle}》提问，例如：作者的核心论点是什么？`}
                          className="min-h-[44px] max-h-[200px] w-full resize-none overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          aria-label="Chat input"
                        />
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {chatEmptySendHint ? (
                          <div
                            role="alert"
                            className="max-w-[14rem] rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 py-1.5 text-center text-xs font-semibold leading-snug text-amber-100 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                          >
                            {chatEmptySendHint}
                          </div>
                        ) : null}
                        <div className="flex items-end gap-3">
                          <span
                            className="inline-flex"
                            title={
                              LEARNING_VOICE_INPUT_ENABLED
                                ? undefined
                                : "语音输入即将上线"
                            }
                          >
                            <button
                              type="button"
                              disabled={
                                !LEARNING_VOICE_INPUT_ENABLED ||
                                chatSending ||
                                isVoiceTranscribing
                              }
                              className={
                                !LEARNING_VOICE_INPUT_ENABLED
                                  ? "inline-flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] text-slate-600 opacity-45"
                                  : isRecording
                                    ? "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/45 bg-red-500/15 text-red-400 shadow-[0_0_0_1px_rgba(239,68,68,0.25)] animate-pulse transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                    : "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                              }
                              aria-label={
                                LEARNING_VOICE_INPUT_ENABLED
                                  ? isRecording
                                    ? "停止语音输入"
                                    : "语音输入"
                                  : "语音输入即将上线"
                              }
                              onClick={
                                LEARNING_VOICE_INPUT_ENABLED
                                  ? () => void toggleVoiceInput()
                                  : undefined
                              }
                            >
                              <Mic className="h-4.5 w-4.5" />
                            </button>
                          </span>

                          <button
                            type="button"
                            onClick={sendMessage}
                            disabled={chatSending}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Send message"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            {chatSending ? "思考中…" : "发送"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void saveSession({ reason: "manual" })}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="End learning"
                            disabled={chatSending || sessionSaving}
                            title="手动结束学习并保存进度"
                          >
                            {sessionSaving ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                保存中…
                              </>
                            ) : (
                              "结束学习"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      提示：`Enter` 发送，`Shift+Enter` 换行；倒计时进入紧急阶段时，AI 会更偏向“短问题 + 快速纠错”。
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

