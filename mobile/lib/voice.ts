// Push-to-talk voice listener — thin wrapper around the browser's Web Speech API.
// Only works on web builds in a SECURE context (https or localhost).
// Returns isSupported=false on native (Expo Go) and on http://LAN-IP/... pages.
import { Platform } from "react-native";

export type VoiceListener = {
  isSupported: boolean;
  start: () => void;
  stop:  () => void;
};

type VoiceOpts = {
  onPartial?: (text: string) => void;
  onFinal:    (text: string) => void;
  onError?:   (code: string) => void;
  onEnd?:     () => void;   // always fires once per session, regardless of outcome
  lang?:      string;
  maxMs?:     number;       // safety auto-stop (default 12 000 ms)
};

export function createVoiceListener(opts: VoiceOpts): VoiceListener {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { isSupported: false, start: () => {}, stop: () => {} };
  }
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) return { isSupported: false, start: () => {}, stop: () => {} };

  // Secure-context check: SpeechRecognition silently produces no audio
  // on http://LAN-IP in iOS Safari and Chrome. Surface this explicitly.
  const secure =
    (window as any).isSecureContext === true ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  let rec: any = null;
  let lastText  = "";
  let ended     = false;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  function cleanup() {
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    rec = null;
  }

  function finishOnce(reason: "final" | "no-speech" | "error", payload?: string) {
    if (ended) return;
    ended = true;
    if (reason === "final" && payload) opts.onFinal(payload);
    else if (reason === "no-speech")    opts.onError?.("no-speech");
    else if (reason === "error")        opts.onError?.(payload || "unknown");
    opts.onEnd?.();
    cleanup();
  }

  function start() {
    if (!secure) {                // tell the caller why nothing will happen
      opts.onError?.("insecure-context");
      opts.onEnd?.();
      return;
    }
    ended    = false;
    lastText = "";
    rec      = new SR();
    // Default English; callers can pass "th-TH" for Thai
    rec.lang            = opts.lang ?? "en-US";
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      lastText = text.trim();
      if (lastText) opts.onPartial?.(lastText);
    };
    rec.onerror = (e: any) => {
      const code = e?.error || "unknown";
      // Browser often fires "no-speech"/"aborted" at the natural end of a session;
      // treat them as benign no-result rather than errors.
      if (code === "no-speech" || code === "aborted") return;
      finishOnce("error", code);
    };
    rec.onend = () => {
      finishOnce(lastText ? "final" : "no-speech", lastText);
    };

    try {
      rec.start();
    } catch (e: any) {
      finishOnce("error", e?.message || "start-failed");
      return;
    }

    // Safety auto-stop: if a release event never reaches us (e.g. iOS gesture
    // routing eats onPressOut), don't let the UI sit on "Listening" forever.
    safetyTimer = setTimeout(() => { try { rec?.stop(); } catch {} }, opts.maxMs ?? 12000);
  }

  function stop() {
    try { rec?.stop(); } catch {}
    // onend will fire and trigger finishOnce.
  }

  return { isSupported: true, start, stop };
}
