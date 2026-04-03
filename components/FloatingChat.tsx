"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";

const INITIAL_GREETING: UIMessage = {
  id: "welcome-local",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "您好！我是梦星（AI PM）的数字分身，在线托管于 mengxing-ai-pm.vercel.app，为 HR、猎头和同行提供 7×24 接待。欢迎直接粘贴 JD 或岗位描述，我会帮您做能力匹配。若想了解实战落地，也可以问我「金融合规智能助手」案例。",
    },
  ],
};

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}

const QUICK_REPLIES = [
  "💼 我有一份 AI PM 的 JD，帮你做个匹配？",
  "🚀 讲讲你的『金融合规智能助手』项目",
  "🛠️ 你搭建 AI 工作流用到哪些技术栈？",
  "📈 落地 AI 项目时，你解决过最大的难点是？",
] as const;

export function FloatingChat() {
  const pathname = usePathname();
  // Hide lobster button inside Learning hub to reduce distraction.
  if (pathname === "/learning" || pathname.startsWith("/learning/")) return null;

  return <FloatingChatInner />;
}

function FloatingChatInner() {
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    messages: [INITIAL_GREETING],
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const text = String(fd.get("message") ?? "").trim();
      if (!text || busy) return;
      void sendMessage({ text });
      form.reset();
    },
    [busy, sendMessage]
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      if (inputRef.current) inputRef.current.value = trimmed;
      void sendMessage({ text: trimmed });
      requestAnimationFrame(() => formRef.current?.reset());
    },
    [busy, sendMessage]
  );

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      {open ? (
        <div
          data-featured-pin-exempt
          className="liquid-glass-card pointer-events-auto flex max-h-[min(560px,calc(100vh-6rem))] w-[min(100vw-2rem,22rem)] sm:w-[24rem] flex-col overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgba(168,85,247,0.12),0_24px_64px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-label="梦星数字分身对话"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">梦星 · 数字分身</p>
              <p className="text-[11px] text-slate-500">AI PM · DeepSeek 驱动</p>
            </div>
            <div className="flex items-center gap-2">
              {busy ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5"
                >
                  停止
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-white/5 hover:text-slate-200"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/30"
                      : "bg-white/5 text-slate-200 ring-1 ring-white/10"
                  }`}
                >
                  {textFromMessage(m)}
                </div>
              </div>
            ))}
            {busy ? (
              <p className="text-center text-xs text-purple-300/90 animate-pulse">
                数字分身正在思考...
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error.message || "请求失败，请稍后重试。"}
              </p>
            ) : null}
          </div>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            className="border-t border-white/10 p-3 pt-2"
          >
            <div
              className="floating-chat-quick-replies mb-2.5 flex gap-2 overflow-x-auto overflow-y-hidden py-0.5"
              role="toolbar"
              aria-label="快捷提问"
            >
              {QUICK_REPLIES.map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  onClick={() => handleQuickReply(label)}
                  className="liquid-glass-card shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-left text-[11px] leading-snug text-slate-300 shadow-sm transition hover:border-gray-500 hover:bg-[rgba(20,20,20,0.75)] hover:text-slate-100 disabled:pointer-events-none disabled:opacity-45"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                name="message"
                type="text"
                autoComplete="off"
                placeholder="粘贴 JD 或随便聊聊…"
                disabled={busy}
                className="liquid-glass-card min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-purple-500/45 focus:ring-1 focus:ring-purple-500/35 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy}
                className="shrink-0 rounded-xl bg-gradient-to-br from-cyan-500/90 to-purple-600/90 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-purple-900/40 transition hover:brightness-110 disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        data-featured-pin-exempt
        onClick={() => setOpen((o) => !o)}
        className="floating-chat-fab liquid-glass-card pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/45 text-2xl shadow-[0_0_0_2px_rgba(6,182,212,0.2),0_0_28px_rgba(168,85,247,0.35)] transition hover:scale-105 hover:border-purple-400/50"
        aria-expanded={open}
        aria-label={open ? "收起对话" : "打开梦星数字分身"}
        title="梦星数字分身"
      >
        <span className="select-none" aria-hidden>
          🦞
        </span>
      </button>

      <style jsx>{`
        @keyframes lobster-pulse {
          0%,
          100% {
            box-shadow:
              0 0 0 2px rgba(6, 182, 212, 0.25),
              0 0 20px rgba(168, 85, 247, 0.35),
              0 0 40px rgba(6, 182, 212, 0.15);
          }
          50% {
            box-shadow:
              0 0 0 3px rgba(217, 70, 239, 0.45),
              0 0 32px rgba(168, 85, 247, 0.5),
              0 0 52px rgba(6, 182, 212, 0.22);
          }
        }
        .floating-chat-fab {
          animation: lobster-pulse 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-chat-fab {
            animation: none;
          }
        }
        .floating-chat-quick-replies {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .floating-chat-quick-replies::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
