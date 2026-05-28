"use client";

import { useCallback, useEffect, useState } from "react";
import { List, Loader2 } from "lucide-react";
import type {
  AihotDailyArchiveItem,
  AihotDailyReport,
} from "@/lib/aihot-daily-api";
import { AIHOT_DAILY_ARCHIVE_TAKE } from "@/lib/aihot-daily-api";
import { AiNewsViewPageHeader } from "@/app/components/ai-news/AiNewsViewPageHeader";
import {
  CATEGORY_PILL_ACTIVE,
  CATEGORY_PILL_IDLE,
  SERIF,
} from "@/app/components/ai-news/AiNewsHubChrome";

const SECTION_EN: Record<string, string> = {
  "模型发布/更新": "MODEL RELEASES",
  "产品发布/更新": "PRODUCT RELEASES",
  行业动态: "INDUSTRY NEWS",
  论文研究: "RESEARCH",
  技巧与观点: "TIPS & OPINIONS",
};

function formatShanghaiDateLabel(ymd: string): string {
  if (ymd.length < 10) return ymd;
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  return `${mo}月${d}日`;
}

function formatChineseDateLine(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const wd = weekdays[new Date(`${ymd}T12:00:00+08:00`).getDay()];
  return `${y}年${mo}月${d}日 · 星期${wd}`;
}

/**
 * AI 日报：固定拉取 AI HOT 最近 30 期归档 + 按日请求完整日报正文
 */
export function AiNewsDailyPanel({ showBackToHome = true }: { showBackToHome?: boolean }) {
  const [archive, setArchive] = useState<AihotDailyArchiveItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [activeYmd, setActiveYmd] = useState("");
  const [report, setReport] = useState<AihotDailyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const loadArchive = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/ai-news/dailies?take=${AIHOT_DAILY_ARCHIVE_TAKE}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const items = (body.items ?? []) as AihotDailyArchiveItem[];
      setArchive(items);
      if (items.length > 0) {
        setActiveYmd((prev) =>
          prev && items.some((i) => i.date === prev) ? prev : items[0].date,
        );
      }
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : String(e));
      setArchive([]);
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (date: string) => {
    if (!date) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/ai-news/daily/${date}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReport(body as AihotDailyReport);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    if (activeYmd) void loadReport(activeYmd);
  }, [activeYmd, loadReport]);

  const leadTitle =
    report?.lead?.title ??
    archive.find((a) => a.date === activeYmd)?.leadTitle ??
    "";
  const leadParagraph = report?.lead?.leadParagraph ?? null;
  const storyCount =
    report?.sections?.reduce((n, s) => n + (s.items?.length ?? 0), 0) ?? 0;
  const volLabel = activeYmd ? activeYmd.replace(/-/g, ".") : "";

  return (
    <>
      <AiNewsViewPageHeader
        title="AI 日报"
        subtitle={`数据来自 AI HOT 官方日报 API · 固定展示最近 ${AIHOT_DAILY_ARCHIVE_TAKE} 期`}
        showBackToHome={showBackToHome}
      />

      {archiveLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          正在拉取最近 {AIHOT_DAILY_ARCHIVE_TAKE} 期日报索引…
        </div>
      ) : archiveError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-8 text-center text-sm text-red-300">
          {archiveError}
          <button
            type="button"
            className="mt-3 block w-full text-cyan-400 hover:underline"
            onClick={() => void loadArchive()}
          >
            重试
          </button>
        </div>
      ) : (
        <div className="flex min-h-[32rem] gap-0 lg:-mr-6">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {archive.map((item) => (
              <button
                key={item.date}
                type="button"
                onClick={() => setActiveYmd(item.date)}
                className={[
                  "shrink-0 rounded-full border px-3 py-1 text-xs",
                  item.date === activeYmd ? CATEGORY_PILL_ACTIVE : CATEGORY_PILL_IDLE,
                ].join(" ")}
              >
                {formatShanghaiDateLabel(item.date)}
              </button>
            ))}
          </div>

          <aside className="hidden w-52 shrink-0 border-r border-white/[0.06] pr-4 lg:block xl:w-56">
            <div className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500/80">
                最新一期
              </p>
              <p className="mt-0.5 text-sm font-medium text-emerald-100">
                {activeYmd ? formatShanghaiDateLabel(activeYmd) : "—"}
              </p>
            </div>
            {activeYmd ? (
              <p className="mb-2 px-1 text-xs text-slate-600">
                {activeYmd.slice(0, 4)}年 {Number(activeYmd.slice(5, 7))}月
              </p>
            ) : null}
            <ul className="max-h-[calc(100vh-16rem)] space-y-0.5 overflow-y-auto">
              {archive.map((item) => {
                const active = item.date === activeYmd;
                const dayNum = Number(item.date.slice(8, 10));
                return (
                  <li key={item.date}>
                    <button
                      type="button"
                      onClick={() => setActiveYmd(item.date)}
                      className={[
                        "flex w-full gap-2 rounded-lg px-2 py-2 text-left text-xs transition",
                        active
                          ? "bg-emerald-500/15 text-emerald-100"
                          : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
                      ].join(" ")}
                    >
                      <span className="w-7 shrink-0 font-mono tabular-nums">{dayNum}日</span>
                      <span className="line-clamp-2 min-w-0 leading-snug">
                        {item.leadTitle ?? "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="min-w-0 flex-1 lg:pl-8">
            {reportLoading && !report ? (
              <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                正在加载 {formatShanghaiDateLabel(activeYmd)} 日报正文…
              </div>
            ) : reportError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-6 text-sm text-red-300">
                {reportError}
                <button
                  type="button"
                  className="mt-2 text-cyan-400 hover:underline"
                  onClick={() => void loadReport(activeYmd)}
                >
                  重试
                </button>
              </div>
            ) : report ? (
              <>
                <header className="mb-10 border-b border-white/[0.08] pb-8">
                  <p className="text-[11px] font-mono tracking-[0.25em] text-slate-500">
                    VOL.{volLabel} · {storyCount} STORIES · AI HOT DAILY
                  </p>
                  <h2
                    className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl"
                    style={{ fontFamily: SERIF }}
                  >
                    <span className="text-slate-100">AI HOT </span>
                    <span className="text-emerald-400">日报</span>
                  </h2>
                  <p className="mt-3 text-sm text-slate-500">
                    {formatChineseDateLine(activeYmd)} · DAILY · 每早八时
                  </p>
                  {leadTitle ? (
                    <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                      <p
                        className="text-lg font-medium leading-snug text-slate-200"
                        style={{ fontFamily: SERIF }}
                      >
                        {leadTitle}
                      </p>
                      {leadParagraph ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          {leadParagraph}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </header>

                {!report.sections.length ? (
                  <p className="text-sm text-slate-500">该日暂无版块内容</p>
                ) : (
                  <div className="space-y-14">
                    {report.sections.map((section, idx) => {
                      const no = String(idx + 1).padStart(2, "0");
                      const en = SECTION_EN[section.label] ?? "SECTION";
                      return (
                        <section key={`${section.label}-${idx}`}>
                          <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/[0.06] pb-3">
                            <div className="flex items-end gap-4">
                              <span
                                className="text-5xl font-light leading-none text-emerald-500/90 sm:text-6xl"
                                style={{ fontFamily: SERIF }}
                              >
                                {no}
                              </span>
                              <div>
                                <h3
                                  className="text-xl font-semibold text-slate-100 sm:text-2xl"
                                  style={{ fontFamily: SERIF }}
                                >
                                  {section.label}
                                </h3>
                                <p className="mt-0.5 text-[10px] font-mono tracking-[0.2em] text-slate-600">
                                  {en}
                                </p>
                              </div>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                              <List className="h-3.5 w-3.5" />
                              {section.items?.length ?? 0}
                            </span>
                          </div>

                          <ul className="space-y-8">
                            {(section.items ?? []).map((item, itemIdx) => (
                              <li
                                key={`${item.sourceUrl}-${itemIdx}`}
                                className="border-b border-white/[0.04] pb-8 last:border-0"
                              >
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-lg font-semibold leading-snug text-slate-100 transition hover:text-emerald-300 sm:text-xl"
                                  style={{ fontFamily: SERIF }}
                                >
                                  {item.title}
                                </a>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                  <span className="rounded border border-white/[0.08] px-1.5 py-0.5">
                                    {section.label}
                                  </span>
                                  <span>{item.sourceName}</span>
                                </div>
                                {item.summary ? (
                                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                                    {item.summary}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                )}

                {report.flashes && report.flashes.length > 0 ? (
                  <section className="mt-14 border-t border-white/[0.08] pt-10">
                    <h3 className="text-lg font-semibold text-slate-200">快讯</h3>
                    <ul className="mt-4 space-y-3">
                      {report.flashes.map((flash, i) => (
                        <li key={`flash-${i}`} className="text-sm text-slate-400">
                          <a
                            href={flash.sourceUrl ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-200 hover:text-emerald-300"
                          >
                            {flash.title}
                          </a>
                          {flash.sourceName ? (
                            <span className="text-slate-600"> — {flash.sourceName}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
