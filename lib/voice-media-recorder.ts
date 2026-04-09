/**
 * 云端语音（Gemini）录音：小体积、低码率优先，缩短上传与转写等待。
 */

export const CLOUD_VOICE_RECORDING_MAX_MS = 60_000;
/** 超过则在上传前提示「录音较长…」（不进行服务端再压缩） */
export const VOICE_UPLOAD_LARGE_BYTES = 500 * 1024;
/** 语音识别足够；约 16 kbps Opus */
export const VOICE_OPUS_TARGET_BITRATE = 16_000;

const OPUS_MIME = "audio/webm;codecs=opus";

function pickMimeWithOptionalBitrate(): MediaRecorderOptions | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported(OPUS_MIME)) {
    return { mimeType: OPUS_MIME, audioBitsPerSecond: VOICE_OPUS_TARGET_BITRATE };
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return { mimeType: "audio/webm", audioBitsPerSecond: VOICE_OPUS_TARGET_BITRATE };
  }
  return undefined;
}

/** 优先 `audio/webm;codecs=opus` + 16kbps；不支持则降级以免抛错 */
export function createOptimizedVoiceMediaRecorder(stream: MediaStream): MediaRecorder {
  const primary = pickMimeWithOptionalBitrate();
  if (primary?.mimeType) {
    try {
      return new MediaRecorder(stream, primary);
    } catch {
      try {
        return new MediaRecorder(stream, { mimeType: primary.mimeType });
      } catch {
        /* fall through */
      }
    }
  }
  return new MediaRecorder(stream);
}
