// Push-to-talk voice listener — thin wrapper around the browser's Web Speech API.
// Only works on web builds (Safari, Chrome). On native (Expo Go) it reports
// isSupported=false; callers should hide the mic button there.
import { Platform } from "react-native";

export type VoiceListener = {
  isSupported: boolean;
  start: () => void;
  stop: () => void;
};

type VoiceOpts = {
  onPartial?: (text: string) => void;
  onFinal:    (text: string) => void;
  onError?:   (msg: string) => void;
  onEnd?:     () => void;
  lang?:      string;   // default "en-US"
};

export function createVoiceListener(opts: VoiceOpts): VoiceListener {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { isSupported: false, start: () => {}, stop: () => {} };
  }
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) {
    return { isSupported: false, start: () => {}, stop: () => {} };
  }

  let rec: any = null;
  let stopped = false;

  function start() {
    stopped = false;
    rec = new SR();
    rec.lang = opts.lang ?? "en-US";
    rec.continuous = false;       // push-to-talk: one utterance per session
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = "";

    rec.onresult = (e: any) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else           partial   += r[0].transcript;
      }
      const all = (finalText + " " + partial).trim();
      if (all) opts.onPartial?.(all);
    };
    rec.onerror = (e: any) => {
      // "no-speech" / "aborted" are common and not interesting to surface
      const code = e?.error || "unknown";
      if (code !== "no-speech" && code !== "aborted") opts.onError?.(code);
    };
    rec.onend = () => {
      if (!stopped) {
        // Browser ended early (e.g. silence). Treat whatever we got as final.
        const text = finalText.trim();
        if (text) opts.onFinal(text);
      }
      opts.onEnd?.();
      rec = null;
    };

    try {
      rec.start();
    } catch (e: any) {
      opts.onError?.(e?.message || "start failed");
    }
  }

  function stop() {
    stopped = true;
    if (!rec) return;
    try { rec.stop(); } catch {}
    // The browser fires onresult+onend asynchronously; commit whatever we have.
  }

  // Wrap stop so the last partial becomes final.
  const wrappedOpts = opts;
  const origStart = start;
  function startWithCommit() {
    let lastText = "";
    const origPartial = wrappedOpts.onPartial;
    wrappedOpts.onPartial = (t: string) => { lastText = t; origPartial?.(t); };
    const origEnd = wrappedOpts.onEnd;
    wrappedOpts.onEnd = () => {
      if (stopped && lastText) wrappedOpts.onFinal(lastText);
      wrappedOpts.onPartial = origPartial;
      wrappedOpts.onEnd = origEnd;
      origEnd?.();
    };
    origStart();
  }

  return { isSupported: true, start: startWithCommit, stop };
}
