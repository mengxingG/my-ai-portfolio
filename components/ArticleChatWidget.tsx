"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  mapPortfolioChatError,
  PortfolioThinkingIndicator,
} from "@/lib/portfolio-chat-ui";

type ArticleChatWidgetProps = {
  articleContext: string;
};

/** 与首页 FloatingChat 一致的占位快捷文案；文章页额外提供「总结当前界面」引导 */
const QUICK_REPLIES = [
  "💼 我有一份 AI PM 的 JD，帮你做个匹配？",
  "🚀 讲讲你的『金融合规智能助手』项目",
  "🛠️ 你搭建 AI 工作流用到哪些技术栈？",
  "📈 落地 AI 项目时，你解决过最大的难点是？",
] as const;

const SUMMARY_PROMPT = "✨ 帮我总结当前界面的内容";

const ARTICLE_CHAT_INITIAL_MESSAGES: UIMessage[] = [
  {
    id: "article-assistant-greeting",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "您好！我是梦星的数字分身。您可以随时通过对话框，让我帮您总结当前界面的核心内容，或者解答关于这篇文章的任何细节。当然，您也可以直接粘贴 JD 看看我与贵司岗位的匹配度！",
      },
    ],
  },
];

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

function AssistantMarkdown({ children }: { children: string }) {
  if (!children.trim()) return null;
  return (
    <div className="chat-message-md w-full min-w-0 text-[13px] leading-relaxed text-slate-200 [&_a]:text-cyan-300 [&_a]:underline [&_a]:decoration-cyan-500/40 [&_blockquote]:border-l-purple-400/50 [&_blockquote]:text-slate-300 [&_code]:rounded [&_code]:bg-black/35 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-cyan-100 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-slate-950/90 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-slate-200 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_th]:border [&_th]:border-white/15 [&_th]:bg-white/5 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1.5">
      <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-slate-50 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:border-white/15">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children: linkChildren, ...rest }) => (
              <a
                {...rest}
                href={href as string | undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-cyan-300 underline decoration-cyan-500/40 hover:text-cyan-200"
              >
                {linkChildren}
              </a>
            ),
          }}
        >
          {children}
        </ReactMarkdown>
      </div>
    </div>
  );
}

const TEXTAREA_MIN_PX = 44;
const TEXTAREA_MAX_PX = 180;

export default function ArticleChatWidget({ articleContext }: ArticleChatWidgetProps) {
  const [input, setInput] = useState("");
  /** 用户显式改用 DeepSeek 后，后续请求走 body.model = deepseek-chat */
  const [preferDeepSeek, setPreferDeepSeek] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const safeContext = useMemo(() => articleContext.trim(), [articleContext]);

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const h = Math.min(Math.max(el.scrollHeight, TEXTAREA_MIN_PX), TEXTAREA_MAX_PX);
    el.style.height = `${h}px`;
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [input, syncTextareaHeight]);

  /** 每次发消息时合并进 POST body；服务端仅用 body.articleContext 拼 System Prompt，不再请求 Notion */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: preferDeepSeek
          ? { articleContext: safeContext, model: "deepseek-chat" as const }
          : { articleContext: safeContext },
      }),
    [safeContext, preferDeepSeek]
  );

  const { messages, sendMessage, status, stop, error, clearError, regenerate } = useChat({
    /** SDK 使用 `messages` 作为初始对话（非 initialMessages） */
    messages: ARTICLE_CHAT_INITIAL_MESSAGES,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const errorMapped = error
    ? mapPortfolioChatError(error.message, { preferDeepSeek })
    : null;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const handleQuickReply = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      void sendMessage({ text: trimmed });
    },
    [busy, sendMessage]
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    requestAnimationFrame(() => syncTextareaHeight());
    await sendMessage({ text });
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  return (
    <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-lg shadow-[0_0_0_1px_rgba(168,85,247,0.12),0_24px_64px_rgba(0,0,0,0.35)]">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">梦星的数字分身</p>
          <p className="text-[11px] text-slate-500">
            {preferDeepSeek
              ? "当前模型：DeepSeek · 基于当前界面内容回答"
              : "基于当前界面内容回答"}
          </p>
        </div>
        {busy ? (
          <button
            type="button"
            onClick={() => void stop()}
            className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5"
          >
            停止
          </button>
        ) : null}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex w-full min-w-0 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`min-w-0 max-w-full rounded-2xl px-3 py-2 sm:px-3.5 ${
                m.role === "user"
                  ? "max-w-[min(100%,32rem)] bg-cyan-500/20 text-sm leading-relaxed text-cyan-50 ring-1 ring-cyan-500/30"
                  : "w-full max-w-[min(100%,42rem)] bg-white/5 text-slate-200 ring-1 ring-white/10"
              }`}
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {textFromMessage(m)}
                </span>
              ) : (
                <AssistantMarkdown>{textFromMessage(m)}</AssistantMarkdown>
              )}
            </div>
          </div>
        ))}
        {busy ? <PortfolioThinkingIndicator label="正在思考" /> : null}
        {error && errorMapped ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-950/35 px-3 py-3 text-xs text-amber-50/95 shadow-[0_0_0_1px_rgba(251,191,36,0.12)]">
            <p className="leading-relaxed">{errorMapped.summary}</p>
            {!preferDeepSeek && errorMapped.suggestDeepSeek ? (
              <button
                type="button"
                className="mt-2.5 w-full rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/25 to-purple-600/25 px-3 py-2 text-center text-[12px] font-medium text-slate-100 transition hover:border-cyan-400/55 hover:brightness-110"
                onClick={() => {
                  setPreferDeepSeek(true);
                  clearError();
                  void regenerate();
                }}
              >
                改用 DeepSeek 重试
              </button>
            ) : (
              <button
                type="button"
                className="mt-2.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-[12px] font-medium text-slate-200 transition hover:bg-white/10"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                重试
              </button>
            )}
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="border-t border-white/10 bg-black/25 p-3 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handleQuickReply(SUMMARY_PROMPT)}
          className="mb-2.5 w-full rounded-xl border border-purple-400/50 bg-gradient-to-r from-purple-500/25 via-fuchsia-500/15 to-cyan-500/20 px-3 py-2.5 text-left text-sm font-semibold leading-snug text-purple-100 shadow-[0_0_24px_rgba(168,85,247,0.22)] transition hover:border-purple-300/60 hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
        >
          {SUMMARY_PROMPT}
        </button>
        <div
          className="article-chat-quick-replies mb-2.5 flex gap-2 overflow-x-auto overflow-y-hidden py-0.5"
          role="toolbar"
          aria-label="快捷提问"
        >
          {QUICK_REPLIES.map((label) => (
            <button
              key={label}
              type="button"
              disabled={busy}
              onClick={() => handleQuickReply(label)}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/[0.05] bg-white/[0.03] px-3 py-1.5 text-left text-[11px] leading-snug text-slate-300 shadow-sm backdrop-blur-lg transition hover:border-gray-500 hover:bg-[rgba(20,20,20,0.75)] hover:text-slate-100 disabled:pointer-events-none disabled:opacity-45"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            autoComplete="off"
            placeholder="基于文章提问…（Shift+Enter 换行，Enter 发送）"
            disabled={busy}
            aria-label="消息输入"
            className="min-h-[44px] max-h-[180px] min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-white/[0.05] bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 outline-none backdrop-blur-lg focus:border-purple-500/45 focus:ring-1 focus:ring-purple-500/35 disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (busy) return;
              const t = input.trim();
              if (!t) return;
              e.currentTarget.form?.requestSubmit();
            }}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 self-end rounded-xl bg-gradient-to-br from-cyan-500/90 to-purple-600/90 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-purple-900/40 transition hover:brightness-110 disabled:opacity-50"
          >
            发送
          </button>
        </div>
        <style jsx>{`
          .article-chat-quick-replies {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .article-chat-quick-replies::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </form>
    </div>
  );
}
