"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Play, X } from "lucide-react";
import {
  extractQuestionBodyAfterMarker,
  parseInterviewReplyMarkers,
  parseReviewReply,
} from "@/lib/interview-markers";
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

type InterviewVoiceState = "idle" | "recording" | "processing";
type QuestionPhase = "listening" | "confirming" | "reviewing" | "waiting";
type Msg = { role: "assistant" | "user"; content: string };
type InterviewHistoryItem = { question: string; userAnswer: string; aiResponse: string };

export type InterviewProgressState = {
  currentQuestion: number;
  totalQuestions: number;
};

type Props = {
  /** Optional: 面试官形象（公文包）或麦克风 as the center avatar icon. */
  centerIcon?: "interviewer" | "mic";
  /** 约定面试总题数（用于进度展示） */
  totalInterviewQuestions?: number;
  /**
   * 与费曼聊天同源：当前 Knowledge 条目的「大纲 + 原文节选」，供面试官 100% 基于文档命题。
   * 对应 /api/interview 的 FormData 字段 `documentContent`。
   */
  documentContent?: string;
  /** 结束面试时，将本轮对话历史回传给父组件 */
  onFinish?: (messages: Msg[]) => void;
  /** 点击「生成评分报告」时调用（与父级 evaluate 对接） */
  onGenerateReport?: (history: InterviewHistoryItem[]) => void | Promise<void>;
};

const DEFAULT_TOTAL_QUESTIONS = 5;

function buildHistoryForEvaluate(
  history: InterviewHistoryItem[],
  totalQuestions: number,
  earlyExit: boolean
): InterviewHistoryItem[] {
  const base = [...history];
  if (!earlyExit) return base;
  const y = Math.max(1, totalQuestions);
  const answered = base.length;
  for (let i = answered + 1; i <= y; i++) {
    base.push({
      question: `第${i}题（未完成）`,
      userAnswer: "（未作答）",
      aiResponse: "",
    });
  }
  return base;
}

function logInterviewApiPayload(meta: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.log("[InterviewVoiceUI] POST /api/interview · FormData 将包含的字段", meta);
}

export function InterviewVoiceUI({
  totalInterviewQuestions = DEFAULT_TOTAL_QUESTIONS,
  documentContent = "",
  onFinish,
  onGenerateReport,
}: Props) {
  /* =========================
   * Question flow (4 phases)
   * ========================= */
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>("listening");
  const [state, setState] = useState<InterviewVoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [caption, setCaption] = useState("点击开始后将进行本地录音，结束后上传到后端识别。");
  const [userTranscript, setUserTranscript] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState<string>("");
  const [aiReviewText, setAiReviewText] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [interviewHistory, setInterviewHistory] = useState<InterviewHistoryItem[]>([]);
  /** 当前题号（与 AI 的【第N题】对齐，初始为 1） */
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<{ x: number; y: number; minutes: number } | null>(
    null
  );
  const [reportBtnLoading, setReportBtnLoading] = useState(false);
  const interviewHistoryRef = useRef<InterviewHistoryItem[]>([]);
  const interviewStartedAtRef = useRef<number | null>(null);
  const earlyExitRef = useRef(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);
  /** 仅在 listening 阶段：可选的文字作答缓冲 */
  const [textAnswerBuffer, setTextAnswerBuffer] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const answerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<Msg[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    interviewHistoryRef.current = interviewHistory;
  }, [interviewHistory]);

  function snapshotFinishStats(x: number, y: number) {
    const t0 = interviewStartedAtRef.current;
    const minutes = t0 != null ? Math.max(1, Math.round((Date.now() - t0) / 60000)) : 0;
    setFinishedSummary({ x, y, minutes });
  }

  const PHASE_HINT_LS_KEY = "interview_voice_phase_hint_shown:v1";
  const [phaseHintShown, setPhaseHintShown] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(PHASE_HINT_LS_KEY);
    setPhaseHintShown(v === "1");
  }, []);

  const theme = useMemo(() => {
    if (state === "recording") return "listening";
    if (state === "processing") return "processing";
    return "idle";
  }, [state]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopRequestedRef = useRef(false);
  /** 浏览器 Web Speech 实时识别（优先）；为 null 时用录音 + 云端转写 */
  const browserSpeechSessionRef = useRef<BrowserSpeechSession | null>(null);
  const [speechLiveUi, setSpeechLiveUi] = useState({ accumulatedFinal: "", interim: "" });
  const [asrFallbackNotice, setAsrFallbackNotice] = useState<string | null>(null);
  /** 当前这一段作答：浏览器实时识别 vs 录音上传云端 */
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<"browser" | "cloud" | null>(null);
  const isMountedRef = useRef(true);
  const requestAbortRef = useRef<AbortController | null>(null);
  const speakUtterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cloudVoiceMaxTimerRef = useRef<number | null>(null);

  async function handleGenerateReport() {
    if (!onGenerateReport || reportBtnLoading) return;
    const padded = buildHistoryForEvaluate(
      [...interviewHistoryRef.current],
      totalInterviewQuestions,
      earlyExitRef.current
    );
    setReportBtnLoading(true);
    try {
      await Promise.resolve(onGenerateReport(padded));
    } finally {
      if (isMountedRef.current) setReportBtnLoading(false);
    }
  }

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    speakUtterRef.current = null;
  }, []);

  const cleanupMediaRecorder = useCallback(() => {
    if (cloudVoiceMaxTimerRef.current != null) {
      window.clearTimeout(cloudVoiceMaxTimerRef.current);
      cloudVoiceMaxTimerRef.current = null;
    }
    setVoiceCaptureMode(null);
    if (browserSpeechSessionRef.current) {
      try {
        browserSpeechSessionRef.current.stop();
      } catch {
        /* noop */
      }
      browserSpeechSessionRef.current = null;
    }
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
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
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

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    cancelInFlightRequest();
    setRequestError(null);
    setLoading(true);
    const controller = new AbortController();
    requestAbortRef.current = controller;
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes("webm") ? "webm" : "wav";
      formData.append("audio", new File([audioBlob], `interview.${ext}`, { type: audioBlob.type || "audio/webm" }));
      formData.append("mode", "transcribe");

      const r = await fetch("/api/interview", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await r.json()) as {
        userTranscript?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const transcript = (data.userTranscript ?? "").trim();
      if (!transcript) throw new Error("Empty ASR payload");
      return { transcript };
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      if (isMountedRef.current) setLoading(false);
    }
  }, [cancelInFlightRequest]);

  const askAiQuestion = useCallback(async (questionNo: number) => {
    cancelInFlightRequest();
    setRequestError(null);
    setLoading(true);
    const controller = new AbortController();
    requestAbortRef.current = controller;
    try {
      const formData = new FormData();
      const doc = String(documentContent ?? "").trim();
      formData.append("mode", "ask");
      formData.append("history", JSON.stringify(messagesRef.current));
      formData.append("totalQuestions", String(Math.max(1, totalInterviewQuestions)));
      formData.append("currentQuestion", String(Math.max(1, questionNo)));
      formData.append("documentContent", doc);
      logInterviewApiPayload({
        mode: "ask",
        documentContentLength: doc.length,
        documentContentPreview: doc.slice(0, 500),
        documentContentIsEmpty: doc.length === 0,
        totalQuestions: Math.max(1, totalInterviewQuestions),
        currentQuestion: Math.max(1, questionNo),
      });

      const r = await fetch("/api/interview", { method: "POST", body: formData, signal: controller.signal });
      const data = (await r.json()) as { aiReply?: string; error?: string };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const reply = (data.aiReply ?? "").trim();
      if (!reply) throw new Error("Empty model reply");
      return reply;
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      if (isMountedRef.current) setLoading(false);
    }
  }, [cancelInFlightRequest, documentContent, totalInterviewQuestions]);

  const reviewAnswer = useCallback(
    async (questionText: string, answerText: string) => {
      cancelInFlightRequest();
      setRequestError(null);
      setLoading(true);
      const controller = new AbortController();
      requestAbortRef.current = controller;
      try {
        const formData = new FormData();
        const doc = String(documentContent ?? "").trim();
        formData.append("mode", "review");
        formData.append("history", JSON.stringify(messagesRef.current));
        formData.append("totalQuestions", String(Math.max(1, totalInterviewQuestions)));
        formData.append("currentQuestion", String(Math.max(1, currentQuestion)));
        formData.append("questionText", questionText);
        formData.append("answerText", answerText);
        formData.append("documentContent", doc);
        logInterviewApiPayload({
          mode: "review",
          documentContentLength: doc.length,
          documentContentPreview: doc.slice(0, 500),
          documentContentIsEmpty: doc.length === 0,
          totalQuestions: Math.max(1, totalInterviewQuestions),
          currentQuestion: Math.max(1, currentQuestion),
        });

        const r = await fetch("/api/interview", { method: "POST", body: formData, signal: controller.signal });
        const data = (await r.json()) as { aiReply?: string; error?: string };
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        const reply = (data.aiReply ?? "").trim();
        if (!reply) throw new Error("Empty model reply");
        return reply;
      } finally {
        if (requestAbortRef.current === controller) requestAbortRef.current = null;
        if (isMountedRef.current) setLoading(false);
      }
    },
    [cancelInFlightRequest, currentQuestion, documentContent, totalInterviewQuestions]
  );

  const startCloudAnswerRecording = useCallback(
    async (opts?: { showRouteNotice?: boolean }): Promise<boolean> => {
      if (interviewEnded) return false;
      const showRouteNotice = opts?.showRouteNotice !== false;

      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setMicError("当前浏览器不支持录音能力（MediaRecorder / getUserMedia）。请使用最新版 Chrome。");
        return false;
      }

      if (showRouteNotice) {
        setAsrFallbackNotice("语音识别已切换为云端模式（录音结束后识别）");
        window.setTimeout(() => setAsrFallbackNotice(null), 8000);
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = createOptimizedVoiceMediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          if (cloudVoiceMaxTimerRef.current != null) {
            window.clearTimeout(cloudVoiceMaxTimerRef.current);
            cloudVoiceMaxTimerRef.current = null;
          }
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          audioChunksRef.current = [];

          if (!isMountedRef.current || !stopRequestedRef.current) {
            setVoiceCaptureMode(null);
            cleanupMediaRecorder();
            return;
          }
          setState("processing");
          if (blob.size > VOICE_UPLOAD_LARGE_BYTES) {
            setCaption("录音较长，识别中…");
          } else {
            setCaption("语音转写中…");
          }
          try {
            const { transcript } = await transcribeAudio(blob);
            if (!isMountedRef.current) return;
            setUserTranscript(transcript);
            setAnswerDraft(transcript);
            setQuestionPhase("confirming");
            setState("idle");
            setCaption("请确认你的回答文字（可修改错别字/补充要点），然后提交给面试官。");
          } catch (e) {
            if (!isMountedRef.current) return;
            const msg = e instanceof Error ? e.message : "Unknown error";
            setRequestError(`接口调用失败：${msg}`);
            setState("idle");
            setCaption("转写失败。你可以重新录音。");
          } finally {
            cleanupMediaRecorder();
          }
        };

        recorder.start(250);
        cloudVoiceMaxTimerRef.current = window.setTimeout(() => {
          cloudVoiceMaxTimerRef.current = null;
          const rec = mediaRecorderRef.current;
          if (rec?.state === "recording") {
            stopRequestedRef.current = true;
            try {
              rec.stop();
            } catch {
              /* noop */
            }
            setState("processing");
            setCaption("已达最长录音时间（60 秒），正在转写…");
          }
        }, CLOUD_VOICE_RECORDING_MAX_MS);
        setVoiceCaptureMode("cloud");
        setState("recording");
        setRecordingSeconds(0);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
        setCaption("本地录音中（最长 60 秒）…结束后将上传云端转写。");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/permission|denied|notallowed/i.test(message)) {
          setMicError("麦克风权限被拒绝：请在浏览器地址栏权限设置中允许麦克风后重试。");
        } else {
          setMicError(`无法启动录音：${message || "unknown error"}`);
        }
        cleanupMediaRecorder();
        setState("idle");
        return false;
      }
    },
    [cleanupMediaRecorder, interviewEnded, transcribeAudio]
  );

  const startRecording = useCallback(async () => {
    if (interviewEnded) return;
    setMicError(null);
    setRequestError(null);
    stopRequestedRef.current = false;
    audioChunksRef.current = [];

    const canUseBrowserSpeech =
      typeof window !== "undefined" && isBrowserSpeechRecognitionSupported();
    let usedBrowserSpeech = false;
    if (canUseBrowserSpeech) {
      setAsrFallbackNotice(null);
      setSpeechLiveUi({ accumulatedFinal: "", interim: "" });
      const session = createBrowserSpeechSession({
        lang: "zh-CN",
        onUpdate: (snap) => setSpeechLiveUi(snap),
        onError: (code) => {
          if (shouldFallbackSpeechRecognitionToCloud(code)) {
            cleanupMediaRecorder();
            setMicError(null);
            setVoiceCaptureMode("cloud");
            setAsrFallbackNotice("语音识别已切换为云端模式（录音结束后识别）");
            window.setTimeout(() => setAsrFallbackNotice(null), 8000);
            setCaption("实时识别不可用，已自动切换云端录音，请继续说完后点击「结束回答」。");
            void startCloudAnswerRecording({ showRouteNotice: false }).then((ok) => {
              if (!isMountedRef.current) return;
              if (!ok) setState("idle");
            });
            return;
          }
          setMicError(speechRecognitionErrorMessage(code));
          cleanupMediaRecorder();
          setState("idle");
        },
      });
      if (session) {
        browserSpeechSessionRef.current = session;
        setVoiceCaptureMode("browser");
        setState("recording");
        setRecordingSeconds(0);
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
        setCaption("实时识别中…说完后点击「结束回答」。");
        usedBrowserSpeech = true;
        return;
      }
    }

    const ok = await startCloudAnswerRecording();
    if (!ok) {
      /* startCloudAnswerRecording 已设置 micError / state */
    }
  }, [cleanupMediaRecorder, interviewEnded, startCloudAnswerRecording]);

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
    setAnswerDraft("");
    setMessages([]);
    setCurrentQuestion(1);
    setInterviewEnded(false);
    setFinishedSummary(null);
    earlyExitRef.current = false;
    interviewStartedAtRef.current = null;
    setReportBtnLoading(false);
    setInterviewHistory([]);
    setCurrentQuestionText("");
    setAiReviewText("");
    setTextAnswerBuffer("");
    setQuestionPhase("listening");
    setCaption("正在生成第 1 题…");
    void (async () => {
      try {
        setState("processing");
        const q = await askAiQuestion(1);
        if (!isMountedRef.current) return;
        const total = Math.max(1, totalInterviewQuestions);
        const { currentN } = parseInterviewReplyMarkers(q, total);
        if (currentN != null) setCurrentQuestion(currentN);
        setCurrentQuestionText(q);
        setMessages([{ role: "assistant", content: q }]);
        interviewStartedAtRef.current = Date.now();
        setCaption("请开始作答。录音时会显示计时；结束回答后进入确认阶段。");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setRequestError(`出题失败：${msg}`);
        setCaption("出题失败。你可以点击开始重试。");
      } finally {
        setState("idle");
      }
    })();
  }

  function requestEarlyEndInterview() {
    if (interviewEnded) return;
    if (
      !window.confirm(
        "确定要提前结束面试吗？已完成的题目会被纳入评分，未完成的题目将标记为未作答。"
      )
    ) {
      return;
    }
    stopSpeaking();
    cancelInFlightRequest();
    stopRequestedRef.current = false;
    cleanupMediaRecorder();
    setState("idle");
    earlyExitRef.current = true;
    const y = Math.max(1, totalInterviewQuestions);
    const x = Math.min(interviewHistoryRef.current.length, y);
    snapshotFinishStats(x, y);
    setInterviewEnded(true);
    setQuestionPhase("waiting");
    setCaption("面试已提前结束。可生成评分报告。");
    setMessages((ms) => [...ms, { role: "assistant", content: "（面试已提前结束）" }]);
  }

  function endAnswer() {
    if (interviewEnded) return;
    if (browserSpeechSessionRef.current) {
      const snap = browserSpeechSessionRef.current.getSnapshot();
      const full = (snap.accumulatedFinal + snap.interim).trim();
      cleanupMediaRecorder();
      setSpeechLiveUi({ accumulatedFinal: "", interim: "" });
      setState("idle");
      if (full) {
        setUserTranscript(full);
        setAnswerDraft(full);
        setQuestionPhase("confirming");
        setCaption("请确认你的回答文字（可修改错别字/补充要点），然后提交给面试官。");
      } else {
        setCaption("未识别到语音。可重新点击「开始录音」或改用下方文字作答。");
        setQuestionPhase("listening");
      }
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopRequestedRef.current = true;
    recorder.stop();
    setState("processing");
    setCaption("正在结束录音并准备转写...");
  }

  async function submitConfirmedAnswer() {
    if (interviewEnded) return;
    const answer = answerDraft.trim();
    if (!answer) return;
    setQuestionPhase("reviewing");
    setState("processing");
    setRequestError(null);
    setAiReviewText("");
    const q = currentQuestionText.trim();
    try {
      setMessages((ms) => [...ms, { role: "user", content: answer }]);
      const reply = await reviewAnswer(q, answer);
      if (!isMountedRef.current) return;
      setAiReviewText(reply);
      setMessages((ms) => [...ms, { role: "assistant", content: reply }]);
      const total = Math.max(1, totalInterviewQuestions);
      const parsed = parseReviewReply(reply, total);

      if (parsed.ended) {
        setInterviewHistory((h) => {
          const nh = [...h, { question: q, userAnswer: answer, aiResponse: reply }];
          snapshotFinishStats(nh.length, total);
          return nh;
        });
        earlyExitRef.current = false;
        setInterviewEnded(true);
        setQuestionPhase("waiting");
        setCaption("面试已结束。可在下方生成评分报告。");
        return;
      }

      if (parsed.isFollowUp) {
        setQuestionPhase("listening");
        setUserTranscript("");
        setAnswerDraft("");
        setTextAnswerBuffer("");
        setCaption("面试官追问，请继续作答（可录音或使用下方文字）。");
        return;
      }

      if (parsed.currentN != null) {
        setInterviewHistory((h) => [...h, { question: q, userAnswer: answer, aiResponse: reply }]);
        earlyExitRef.current = false;
        setCurrentQuestion(parsed.currentN);
        const body = extractQuestionBodyAfterMarker(reply).trim();
        setCurrentQuestionText(body || reply.trim());
        setUserTranscript("");
        setAnswerDraft("");
        setTextAnswerBuffer("");
        setQuestionPhase("listening");
        setCaption(`已进入第 ${parsed.currentN} 题，请作答。`);
        return;
      }

      setInterviewHistory((h) => {
        const nh = [...h, { question: q, userAnswer: answer, aiResponse: reply }];
        if (currentQuestion >= total) {
          snapshotFinishStats(nh.length, total);
        }
        return nh;
      });
      earlyExitRef.current = false;

      if (currentQuestion >= total) {
        setInterviewEnded(true);
        setQuestionPhase("waiting");
        setCaption("面试已结束。可在下方生成评分报告。");
        return;
      }

      setQuestionPhase("waiting");
      setCaption(
        parsed.hasNextTopicMarker ? "可以进入下一题了。" : "本题已完成。准备好了再进入下一题。"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setRequestError(`评审失败：${msg}`);
      setQuestionPhase("confirming");
      setCaption("评审失败。你可以再次提交或重新录音。");
    } finally {
      setState("idle");
    }
  }

  function reRecord() {
    if (interviewEnded) return;
    stopRequestedRef.current = false;
    cleanupMediaRecorder();
    setSpeechLiveUi({ accumulatedFinal: "", interim: "" });
    setUserTranscript("");
    setAnswerDraft("");
    setTextAnswerBuffer("");
    setQuestionPhase("listening");
    setCaption("已回到录音阶段。开始录音后作答。");
  }

  function beginRecording() {
    if (interviewEnded) return;
    if (questionPhase !== "listening") return;
    void startRecording();
  }

  function goNextQuestionOrFinish() {
    if (interviewEnded) return;
    const total = Math.max(1, totalInterviewQuestions);
    const isLast = currentQuestion >= total;
    if (isLast) {
      earlyExitRef.current = false;
      snapshotFinishStats(interviewHistory.length, total);
      setInterviewEnded(true);
      setQuestionPhase("waiting");
      setCaption("面试已结束。可在下方生成评分报告。");
      setMessages((ms) => [
        ...ms,
        { role: "assistant", content: "【面试结束】\n本轮面试已完成。你可以生成评分报告。" },
      ]);
      return;
    }
    const nextN = Math.min(total, currentQuestion + 1);
    setCurrentQuestion(nextN);
    setQuestionPhase("listening");
    setUserTranscript("");
    setAnswerDraft("");
    setTextAnswerBuffer("");
    setAiReviewText("");
    setCurrentQuestionText("");
    setCaption(`正在生成第 ${nextN} 题…`);
    void (async () => {
      try {
        setState("processing");
        const q = await askAiQuestion(nextN);
        if (!isMountedRef.current) return;
        setCurrentQuestionText(q);
        setMessages((ms) => [...ms, { role: "assistant", content: q }]);
        setCaption("请开始作答。录音结束后进入确认阶段。");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setRequestError(`出题失败：${msg}`);
        setCaption("出题失败。你可以点击“下一题”重试。");
      } finally {
        setState("idle");
      }
    })();
  }

  const totalQ = Math.max(1, totalInterviewQuestions);
  const displayQuestionUi = interviewEnded ? totalQ : Math.min(Math.max(1, currentQuestion), totalQ);
  const progressPercent = Math.min(100, (displayQuestionUi / totalQ) * 100);

  useEffect(() => {
    // 新消息自动滚动到底部
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, interviewEnded, finishedSummary]);

  useEffect(() => {
    const el = answerInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [textAnswerBuffer, questionPhase, state, voiceCaptureMode, speechLiveUi.accumulatedFinal, speechLiveUi.interim]);

  useEffect(() => {
    const el = confirmInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [answerDraft, questionPhase]);

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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0f1115] text-slate-100">
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

      <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0b0f16] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.70)]">
          {/* Progress (compact, 30px) */}
          <div className="flex h-[30px] shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
            <div className="text-xs font-semibold tabular-nums text-slate-200">
              第 {displayQuestionUi} 题 / 共 {totalQ} 题
            </div>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-white/[0.10]" role="progressbar">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500/90 via-purple-500/85 to-purple-400/80 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Chat area */}
          <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {messages.length ? (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div
                    key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                    className={[
                      "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                      m.role === "assistant"
                        ? "self-start border-white/10 bg-white/[0.03] text-slate-100"
                        : "self-end border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
                    ].join(" ")}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            ) : (
              <div className="text-sm text-slate-500">点击开始后，面试官会直接提问。</div>
            )}
          </div>

          {/* Input area (sticky bottom) */}
          <div className="sticky bottom-0 shrink-0 border-t border-white/10 bg-[#0b0f16]/95 px-4 py-3 backdrop-blur">
            {/* phase hint (once) */}
            {!phaseHintShown && !interviewEnded ? (
              <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-slate-300">
                提示：流程是「作答 → 确认 → 面试官回应 → 下一题」。这条提示只会出现一次。
              </div>
            ) : null}
            {!phaseHintShown && messages.length > 0 ? (
              <div className="hidden" />
            ) : null}

            {micError ? (
              <div className="mb-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {micError}
              </div>
            ) : null}
            {asrFallbackNotice ? (
              <div className="mb-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                {asrFallbackNotice}
              </div>
            ) : null}
            {requestError ? (
              <div className="mb-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {requestError}
              </div>
            ) : null}

            <div className="mb-1 text-[11px] text-slate-500">
              {questionPhase === "listening"
                ? state === "recording"
                  ? "作答中…"
                  : "阶段 1：作答"
                : questionPhase === "confirming"
                  ? "阶段 2：确认回答"
                  : questionPhase === "reviewing"
                    ? "阶段 3：面试官回应"
                    : "阶段 4：下一题"}
            </div>

            {/* Start / Ended */}
            {state === "idle" && messages.length === 0 && !interviewEnded ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(PHASE_HINT_LS_KEY, "1");
                      setPhaseHintShown(true);
                    }
                    startInterview();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/15"
                >
                  <Play className="h-4 w-4" />
                  开始
                </button>
                <button
                  type="button"
                  onClick={requestEarlyEndInterview}
                  className="inline-flex items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
                >
                  结束面试
                </button>
              </div>
            ) : interviewEnded ? (
              <div className="space-y-2">
                {finishedSummary ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
                    <div className="text-sm font-semibold text-emerald-100">
                      面试已结束，共完成 {finishedSummary.x}/{finishedSummary.y} 道题
                    </div>
                    <div className="mt-1 text-xs text-emerald-100/90">
                      {finishedSummary.minutes > 0 ? `用时：${finishedSummary.minutes} 分钟` : "用时：—"}
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={reportBtnLoading || !onGenerateReport}
                  onClick={() => void handleGenerateReport()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reportBtnLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      AI 正在评估…
                    </>
                  ) : (
                    <>生成评分报告</>
                  )}
                </button>
              </div>
            ) : (
              <>
                {/* Voice mode (simplified): mic + hint + input */}
                {questionPhase === "listening" ? (
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={state === "recording" ? endAnswer : beginRecording}
                      disabled={loading || state === "processing"}
                      className={[
                        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition",
                        state === "recording"
                          ? "border-red-500/45 bg-red-500/15 text-red-200"
                          : "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      ].join(" ")}
                      aria-label={state === "recording" ? "结束录音" : "开始录音"}
                      title={state === "recording" ? "结束录音" : "开始录音"}
                    >
                      {state === "recording" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-[11px] text-slate-500">
                        点击录音，或直接在输入框打字
                      </div>
                      <textarea
                        ref={answerInputRef}
                        value={
                          state === "recording" && voiceCaptureMode === "browser"
                            ? `${speechLiveUi.accumulatedFinal}${speechLiveUi.interim}`.trim()
                            : textAnswerBuffer
                        }
                        onChange={(e) => setTextAnswerBuffer(e.target.value)}
                        disabled={loading || state === "processing"}
                        rows={1}
                        placeholder={state === "recording" ? "录音中…（转写会显示在这里）" : "输入你的回答…"}
                        className="min-h-11 max-h-[120px] w-full resize-none overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          if (e.shiftKey) return; // Shift+Enter 换行
                          e.preventDefault();
                          const t = textAnswerBuffer.trim();
                          if (!t) return;
                          setUserTranscript(t);
                          setAnswerDraft(t);
                          setTextAnswerBuffer("");
                          setQuestionPhase("confirming");
                          setCaption("请确认文字回答，可修改后再提交。");
                          if (typeof window !== "undefined" && window.localStorage.getItem(PHASE_HINT_LS_KEY) !== "1") {
                            window.localStorage.setItem(PHASE_HINT_LS_KEY, "1");
                            setPhaseHintShown(true);
                          }
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const t = textAnswerBuffer.trim();
                        if (!t) return;
                        setUserTranscript(t);
                        setAnswerDraft(t);
                        setTextAnswerBuffer("");
                        setQuestionPhase("confirming");
                        setCaption("请确认文字回答，可修改后再提交。");
                        if (typeof window !== "undefined" && window.localStorage.getItem(PHASE_HINT_LS_KEY) !== "1") {
                          window.localStorage.setItem(PHASE_HINT_LS_KEY, "1");
                          setPhaseHintShown(true);
                        }
                      }}
                      disabled={loading || !textAnswerBuffer.trim() || state === "processing"}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="发送"
                      title="发送"
                    >
                      发送
                    </button>

                    <button
                      type="button"
                      onClick={requestEarlyEndInterview}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
                    >
                      结束面试
                    </button>
                  </div>
                ) : questionPhase === "confirming" ? (
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <textarea
                        ref={confirmInputRef}
                        value={answerDraft}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        disabled={interviewEnded || loading}
                        rows={1}
                        className="min-h-11 max-h-[120px] w-full resize-none overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="可编辑你的回答…"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          if (e.shiftKey) return;
                          e.preventDefault();
                          if (!answerDraft.trim()) return;
                          submitConfirmedAnswer();
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={submitConfirmedAnswer}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={loading || !answerDraft.trim()}
                    >
                      确认提交
                    </button>
                    <button
                      type="button"
                      onClick={reRecord}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                      disabled={loading}
                    >
                      重新输入
                    </button>
                    <button
                      type="button"
                      onClick={requestEarlyEndInterview}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
                    >
                      结束面试
                    </button>
                  </div>
                ) : questionPhase === "waiting" ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">{caption}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={goNextQuestionOrFinish}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                      >
                        {currentQuestion >= totalQ ? "查看面试结果" : "下一题"}
                      </button>
                      <button
                        type="button"
                        onClick={requestEarlyEndInterview}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
                      >
                        结束面试
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      {state === "processing" ? "处理中…" : caption}
                    </div>
                    <button
                      type="button"
                      onClick={requestEarlyEndInterview}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
                    >
                      结束面试
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

