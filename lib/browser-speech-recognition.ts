/**
 * Web Speech API（语音识别）：Chrome / Edge / Safari 等。
 * 需 HTTPS 或 localhost。
 */

export type BrowserSpeechSnapshot = {
  accumulatedFinal: string;
  interim: string;
};

export type BrowserSpeechSession = {
  stop: () => void;
  getSnapshot: () => BrowserSpeechSnapshot;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Web Speech 发生这些错误时，可无缝改为 MediaRecorder + 云端转写（用户无需再次点击麦克风）。
 * `network`：偶发连不上浏览器厂商语音识别服务；`service-not-allowed`：策略/地区限制等。
 */
export function shouldFallbackSpeechRecognitionToCloud(code: string): boolean {
  const c = String(code || "").trim().toLowerCase();
  return c === "network" || c === "service-not-allowed";
}

/** 将 `SpeechRecognitionErrorEvent.error` 转成用户可读中文（含常见排障提示） */
export function speechRecognitionErrorMessage(code: string): string {
  const c = String(code || "").trim().toLowerCase();
  const map: Record<string, string> = {
    network:
      "无法连接浏览器实时语音识别服务（多为网络限制）。可改用云端录音识别，或检查网络/VPN 后重试。",
    "service-not-allowed":
      "浏览器不允许使用语音服务（可能被策略或权限关闭）。可尝试换 Chrome/Edge，或使用云端录音识别。",
    "audio-capture":
      "无法访问麦克风（可能被占用或未授权）。请在浏览器设置中允许麦克风，并关闭其它在用麦克风的应用。",
    "not-allowed": "麦克风权限被拒绝。请在地址栏旁允许麦克风后重试。",
    aborted: "识别已中止。",
    "no-speech": "未检测到语音，可走近麦克风或提高音量后再试。",
    "language-not-supported": "当前浏览器不支持所选语言（zh-CN），可尝试改用 Chrome。",
    "bad-grammar": "识别参数异常，请刷新页面后重试。",
  };
  return map[c] ?? `识别异常（代码：${code || "unknown"}）。可改用云端录音或刷新后重试。`;
}

/**
 * 启动连续识别；停止前会持续监听，onend 时自动 restart（除非已 stop）。
 */
export function createBrowserSpeechSession(params: {
  lang?: string;
  onUpdate: (snap: BrowserSpeechSnapshot) => void;
  onError?: (code: string) => void;
}): BrowserSpeechSession | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  let accumulatedFinal = "";
  let interim = "";
  let manualStop = false;
  /** 出现不可恢复错误后禁止 onend 里自动 start，避免刷屏报错 */
  let broken = false;

  const rec = new Ctor();
  rec.lang = params.lang ?? "zh-CN";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event: SpeechRecognitionEventLike) => {
    let pieceInterim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) accumulatedFinal += t;
      else pieceInterim += t;
    }
    interim = pieceInterim;
    params.onUpdate({ accumulatedFinal, interim });
  };

  rec.onerror = (ev: SpeechRecognitionErrorLike) => {
    const err = ev.error;
    if (err === "aborted" || err === "canceled") return;
    if (err === "no-speech") return;
    broken = true;
    manualStop = true;
    params.onError?.(err);
  };

  rec.onend = () => {
    if (manualStop || broken) return;
    try {
      rec.start();
    } catch {
      /* InvalidStateError: already started */
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop() {
      manualStop = true;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
    getSnapshot() {
      return { accumulatedFinal, interim };
    },
  };
}
