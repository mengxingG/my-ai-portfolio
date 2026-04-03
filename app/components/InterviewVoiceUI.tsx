"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Mic, MicOff, Pause, Play, Sparkles, Volume2, VolumeX, X } from "lucide-react";

type InterviewVoiceState = "idle" | "recording" | "processing" | "speaking";

type Props = {
  /** Optional: show Bot (default) or Mic as the center avatar icon. */
  centerIcon?: "bot" | "mic";
};

export function InterviewVoiceUI({
  centerIcon = "bot",
}: Props) {
  /* =========================
   * State machine (4 states)
   * ========================= */
  const [state, setState] = useState<InterviewVoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [caption, setCaption] = useState("点击开始后将进行本地录音，结束后上传到后端识别。");
  const [userTranscript, setUserTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [interviewerText, setInterviewerText] = useState<string>("");

  const CenterIcon = centerIcon === "mic" ? Mic : Bot;

  const theme = useMemo(() => {
    if (state === "speaking") return "speaking";
    if (state === "recording") return "listening";
    if (state === "processing") return "processing";
    return "idle";
  }, [state]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopRequestedRef = useRef(false);
  const isMountedRef = useRef(true);
  const requestAbortRef = useRef<AbortController | null>(null);
  const speakUtterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    speakUtterRef.current = null;
  }, []);

  const cleanupMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // noop
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  const cancelInFlightRequest = useCallback(() => {
    if (requestAbortRef.current) requestAbortRef.current.abort();
    requestAbortRef.current = null;
  }, []);

  const pickZhVoice = useCallback(async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const synth = window.speechSynthesis;
    const tryPick = () => {
      const voices = synth.getVoices();
      return (
        voices.find((v) => v.lang?.toLowerCase().startsWith("zh")) ??
        voices.find((v) => /chinese|mandarin|xiaoxiao|yunxi|mei-jia/i.test(v.name))
      );
    };
    const first = tryPick();
    if (first) return first;
    // Some browsers populate voices async.
    await new Promise<void>((resolve) => {
      let done = false;
      const t = window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, 500);
      synth.onvoiceschanged = () => {
        if (done) return;
        done = true;
        window.clearTimeout(t);
        resolve();
      };
    });
    return tryPick();
  }, []);

  const speakInterviewer = useCallback(
    async (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
      const content = text.trim();
      if (!content) return false;

      const synth = window.speechSynthesis;
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(content);
      speakUtterRef.current = utter;
      utter.lang = "zh-CN";
      utter.rate = 1;
      utter.pitch = 1;
      utter.volume = muted ? 0 : 1;

      const voice = await pickZhVoice();
      if (voice) utter.voice = voice;

      return await new Promise<boolean>((resolve) => {
        utter.onend = () => resolve(true);
        utter.onerror = () => resolve(false);
        synth.speak(utter);
      });
    },
    [muted, pickZhVoice]
  );

  const sendAudioForInterview = useCallback(async (audioBlob: Blob) => {
    cancelInFlightRequest();
    setRequestError(null);
    setLoading(true);
    const controller = new AbortController();
    requestAbortRef.current = controller;
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes("webm") ? "webm" : "wav";
      formData.append("audio", new File([audioBlob], `interview.${ext}`, { type: audioBlob.type || "audio/webm" }));

      const r = await fetch("/api/interview", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await r.json()) as {
        userTranscript?: string;
        aiReply?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const transcript = (data.userTranscript ?? "").trim();
      const reply = (data.aiReply ?? "").trim();
      if (!transcript || !reply) {
        throw new Error("Empty ASR/LLM payload");
      }
      return { transcript, reply };
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      if (isMountedRef.current) setLoading(false);
    }
  }, [cancelInFlightRequest]);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setMicError("当前浏览器不支持录音能力（MediaRecorder / getUserMedia）。请使用最新版 Chrome。");
      return;
    }
    setMicError(null);
    setRequestError(null);
    stopRequestedRef.current = false;
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];

        if (!isMountedRef.current || !stopRequestedRef.current) return;
        setState("processing");
        setCaption("面试官正在评估...");
        try {
          const { transcript, reply } = await sendAudioForInterview(blob);
          if (!isMountedRef.current) return;
          setUserTranscript(transcript);
          setInterviewerText(reply);
          setState("speaking");
          setCaption(reply);
          const ok = await speakInterviewer(reply);
          if (!isMountedRef.current) return;
          setState("idle");
          setCaption(ok ? "一轮结束。点击开始进入下一题。" : "播报失败，但文字已显示。点击开始进入下一题。");
        } catch (e) {
          if (!isMountedRef.current) return;
          const msg = e instanceof Error ? e.message : "Unknown error";
          setRequestError(`接口调用失败：${msg}`);
          setState("idle");
          setCaption("接口调用失败。你可以重试开始下一轮。");
        } finally {
          cleanupMediaRecorder();
        }
      };

      recorder.start(250);
      setState("recording");
      setCaption("本地录音中…请开始回答。点击“结束回答”后将上传到后端识别。");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/permission|denied|notallowed/i.test(message)) {
        setMicError("麦克风权限被拒绝：请在浏览器地址栏权限设置中允许麦克风后重试。");
      } else {
        setMicError(`无法启动录音：${message || "unknown error"}`);
      }
      cleanupMediaRecorder();
      setState("idle");
    }
  }, [cleanupMediaRecorder, sendAudioForInterview, speakInterviewer]);

  /* =========================
   * UI actions
   * ========================= */
  function startInterview() {
    stopSpeaking();
    setPaused(false);
    setMuted(false);
    setMicError(null);
    setRequestError(null);
    setUserTranscript("");
    setInterviewerText("");
    setCaption("正在请求麦克风权限并启动本地录音…");
    void startRecording();
  }

  function endInterview() {
    stopSpeaking();
    cancelInFlightRequest();
    stopRequestedRef.current = false;
    cleanupMediaRecorder();
    setState("idle");
    setPaused(false);
    setMuted(false);
    setCaption("面试已结束。你可以再次点击开始，重新进入模拟。");
  }

  function endAnswer() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopRequestedRef.current = true;
    recorder.stop();
    setState("processing");
    setCaption("面试官正在思考...");
  }

  function simulateAiSpeaking() {
    stopRequestedRef.current = false;
    cleanupMediaRecorder();
    setState("speaking");
    const mock = "（模拟）面试官提问：请用 STAR 法复盘一次你处理线上故障的经历。";
    setInterviewerText(mock);
    setCaption(mock);
    void (async () => {
      const ok = await speakInterviewer(mock);
      if (!isMountedRef.current) return;
      setState("idle");
      setCaption(ok ? "一轮结束。点击开始进入下一题。" : "播报失败，但文字已显示。点击开始进入下一题。");
    })();
  }

  function backToListening() {
    setPaused(false);
    setMuted(false);
    setCaption("正在准备下一轮录音…");
    void startRecording();
  }

  const showControls = state === "recording" || state === "speaking";
  const showAnswerControls = state === "recording" || state === "processing" || state === "speaking";

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelInFlightRequest();
      stopSpeaking();
      cleanupMediaRecorder();
    };
  }, [cancelInFlightRequest, cleanupMediaRecorder, stopSpeaking]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1115] p-6 text-slate-100">
      <style jsx global>{`
        /* ==========================================
         * InterviewVoiceUI animations (CSS-only)
         * ========================================== */
        @keyframes ivui-ripple {
          0% {
            transform: scale(0.72);
            opacity: 0.7;
          }
          70% {
            opacity: 0.14;
          }
          100% {
            transform: scale(1.55);
            opacity: 0;
          }
        }

        @keyframes ivui-glow {
          0% {
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.02);
          }
          100% {
            opacity: 0.35;
            transform: scale(1);
          }
        }

        @keyframes ivui-radar {
          0% {
            transform: rotate(0deg);
            opacity: 0.55;
          }
          100% {
            transform: rotate(360deg);
            opacity: 0.55;
          }
        }

        @keyframes ivui-softFlicker {
          0%,
          100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>

      <div className="relative w-full max-w-[720px]">
        {/* Main card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
          {/* Header hint */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-400">Interview · Voice</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                模拟面试官考核
                <span className="ml-2 align-middle text-xs font-mono text-rose-200/80">
                  {state === "speaking" ? "LIVE" : state === "processing" ? "EVAL" : "READY"}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {state === "idle"
                  ? "点击开始后会请求麦克风权限，并进行本地录音。"
                  : state === "recording"
                    ? "本地录音中。说完后点击“结束回答”上传到后端评估。"
                    : state === "processing"
                      ? "面试官正在评估..."
                      : "面试官提问中（波纹代表语音输出）。"}
              </div>
            </div>

            {state !== "idle" ? (
              <button
                type="button"
                onClick={simulateAiSpeaking}
                className="shrink-0 rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-100 transition hover:bg-purple-500/15"
                aria-label="Simulate AI speaking"
              >
                <Sparkles className="mr-2 inline h-4 w-4" />
                模拟AI回复
              </button>
            ) : null}
          </div>

          {micError ? (
            <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {micError}
            </div>
          ) : null}
          {requestError ? (
            <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {requestError}
            </div>
          ) : null}

          {/* Center stage */}
          <div className="mt-7 flex items-center justify-center">
            <div className="relative">
              {/* Ripple layers (speaking) */}
              {theme === "speaking" ? (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={`ripple-${i}`}
                      aria-hidden
                      className="absolute left-1/2 top-1/2 block h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle at center, rgba(168,85,247,0.22) 0%, rgba(34,211,238,0.14) 35%, rgba(168,85,247,0.04) 60%, rgba(0,0,0,0) 72%)",
                        border: "1px solid rgba(168,85,247,0.18)",
                        animation: `ivui-ripple 1.65s ease-out ${i * 0.35}s infinite`,
                        filter: "blur(0.2px)",
                      }}
                    />
                  ))}
                </>
              ) : null}

              {/* Recording ripple + glow */}
              {theme === "listening" ? (
                <>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <span
                      // eslint-disable-next-line react/no-array-index-key
                      key={`listen-ripple-${i}`}
                      aria-hidden
                      className="absolute left-1/2 top-1/2 block h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle at center, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0.10) 35%, rgba(34,211,238,0.03) 60%, rgba(0,0,0,0) 72%)",
                        border: "1px solid rgba(34,211,238,0.14)",
                        animation: `ivui-ripple 2.1s ease-out ${i * 0.65}s infinite`,
                      }}
                    />
                  ))}
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 block h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at center, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.08) 40%, rgba(0,0,0,0) 72%)",
                      animation: "ivui-glow 1.9s ease-in-out infinite",
                    }}
                  />
                </>
              ) : null}

              {/* Processing radar (processing only) */}
              {theme === "processing" ? (
                <>
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 block h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
                    style={{
                      background:
                        "radial-gradient(circle at center, rgba(148,163,184,0.05) 0%, rgba(148,163,184,0.03) 45%, rgba(0,0,0,0) 72%)",
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 block h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, rgba(34,211,238,0.0), rgba(34,211,238,0.18), rgba(168,85,247,0.0) 55%)",
                      animation: "ivui-radar 1.2s linear infinite",
                      maskImage:
                        "radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 76%)",
                      WebkitMaskImage:
                        "radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 76%)",
                    }}
                  />
                </>
              ) : null}

              {/* Core avatar */}
              <div
                className={[
                  "relative grid h-[120px] w-[120px] place-items-center rounded-full border",
                  theme === "idle"
                    ? "border-white/10 bg-black/20"
                    : theme === "listening"
                      ? "border-cyan-500/25 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_0_40px_rgba(34,211,238,0.10)]"
                      : theme === "processing"
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-purple-500/25 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.14),0_0_45px_rgba(168,85,247,0.12)]",
                ].join(" ")}
                style={{
                  animation: theme === "processing" ? "ivui-softFlicker 1.05s ease-in-out infinite" : undefined,
                }}
              >
                <CenterIcon
                  className={[
                    "h-10 w-10",
                    theme === "idle"
                      ? "text-slate-300"
                      : theme === "listening"
                        ? "text-cyan-200"
                        : theme === "processing"
                          ? "text-slate-200"
                          : "text-purple-200",
                  ].join(" ")}
                  aria-hidden
                />
                {theme === "listening" ? (
                  <span
                    className="absolute bottom-3 inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-black/25 px-2 py-1 text-[11px] font-mono text-cyan-100/90"
                    aria-hidden
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.45)]" />
                    recording
                  </span>
                ) : theme === "speaking" ? (
                  <span
                    className="absolute bottom-3 inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-black/25 px-2 py-1 text-[11px] font-mono text-purple-100/90"
                    aria-hidden
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-300 shadow-[0_0_18px_rgba(168,85,247,0.45)]" />
                    speaking
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Caption area (字幕) */}
          <div className="mt-7">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs font-mono text-slate-500">字幕</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-200/95">
                {state === "recording" ? (
                  <>
                    <div className="text-slate-300/90">录音中…结束后会在这里显示你的转写文本。</div>
                    <div className="mt-2 text-xs text-slate-500">{caption}</div>
                  </>
                ) : (
                  <>
                    {state === "speaking" ? (
                      <div className="text-slate-100/95">{interviewerText || caption}</div>
                    ) : (
                      caption
                    )}
                    {loading ? (
                      <div className="mt-2 text-xs font-mono text-cyan-200/80">loading…</div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom area: idle CTA */}
          {state === "idle" ? (
            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={startInterview}
                className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-500/20 to-white/[0.03] px-6 py-3 text-sm font-semibold text-purple-100 transition hover:from-purple-500/25 hover:to-white/[0.05]"
              >
                <Play className="h-4 w-4" />
                开始模拟面试
              </button>
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {state === "processing" ? "面试官正在评估..." : "保持节奏：短句、结构、先结论。"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaused((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                  aria-pressed={paused}
                >
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {paused ? "继续" : "暂停"}
                </button>
                <button
                  type="button"
                  onClick={() => setMuted((v) => !v)}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    muted
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                      : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]",
                  ].join(" ")}
                  aria-pressed={muted}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {muted ? "已静音" : "静音"}
                </button>
                {showAnswerControls ? (
                  <button
                    type="button"
                    onClick={state === "speaking" ? backToListening : endAnswer}
                    className={[
                      "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                      state === "speaking"
                        ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15"
                        : "border-purple-500/25 bg-purple-500/10 text-purple-100 hover:bg-purple-500/15",
                    ].join(" ")}
                    disabled={loading}
                  >
                    {state === "speaking" ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    {state === "speaking" ? "继续回答" : "结束回答"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={endInterview}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
                >
                  <X className="h-4 w-4" />
                  结束面试
                </button>
              </div>
            </div>
          )}

          {/* Floating control bar (active states) */}
          {showControls ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur">
                <button
                  type="button"
                  onClick={endInterview}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
                >
                  <X className="h-4 w-4" />
                  结束面试
                </button>
                <button
                  type="button"
                  onClick={() => setMuted((v) => !v)}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    muted
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                      : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]",
                  ].join(" ")}
                  aria-pressed={muted}
                >
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {muted ? "静音中" : "静音"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

