// Tap-to-toggle voice capture button.
// Caller supplies `onApply(text)` which receives the final transcript;
// it's up to the caller to feed it through `parseVoice` and act on the result.
// This component owns: UI states, animations, error toasts, mic lifecycle.
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { createVoiceListener, type VoiceListener } from "@/lib/voice";

const LANG_KEY = "gv:voice_lang";
export type VoiceLang = "en-US" | "th-TH";

type Props = {
  /** Receives the final transcript when the user releases or recognition ends. */
  onApply: (transcript: string) => void | Promise<void>;
  /** Short hint shown when idle, e.g. 'e.g. "hole 1 Noo 4133"'. */
  hint?: string;
  /** Optional status line shown above the hint (e.g. "Now: Hole 5 · Noo"). */
  contextLabel?: string;
};

export function VoiceCapture({ onApply, hint, contextLabel }: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [text,  setText]  = useState("");
  const [toast, setToast] = useState("");
  const [lang,  setLang]  = useState<VoiceLang>("en-US");
  const ref = useRef<VoiceListener | null>(null);
  const supportedRef = useRef<boolean | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Restore preferred language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(v => {
      if (v === "en-US" || v === "th-TH") setLang(v);
    });
  }, []);
  async function toggleLang() {
    const next: VoiceLang = lang === "en-US" ? "th-TH" : "en-US";
    setLang(next);
    await AsyncStorage.setItem(LANG_KEY, next);
  }

  if (supportedRef.current === null) {
    const probe = createVoiceListener({ onFinal: () => {} });
    supportedRef.current = probe.isSupported;
  }
  const supported = supportedRef.current;

  useEffect(() => {
    if (state !== "listening") { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function handleError(code: string) {
    if (code === "insecure-context")
      showToast("🔒  Voice needs HTTPS. Open the Azure URL on your phone.");
    else if (code === "no-speech")
      showToast("🤫  Didn't catch any speech. Try again.");
    else if (code === "not-allowed" || code === "service-not-allowed")
      showToast("🎤  Microphone blocked. Allow it in browser settings.");
    else if (code === "audio-capture")
      showToast("🎤  No microphone found.");
    else
      showToast(`🎤  ${code}`);
  }

  function start() {
    if (!supported || state === "listening") return;
    setText("");
    setState("listening");
    ref.current = createVoiceListener({
      lang,
      onPartial: setText,
      onFinal:   async (t) => { setState("thinking"); try { await onApply(t); } finally { /* state cleared by onEnd */ } },
      onError:   handleError,
      onEnd:     ()  => { setState("idle"); setText(""); }
    });
    ref.current.start();
  }
  function stop() { ref.current?.stop(); }

  if (!supported) return null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Pressable
        onPress={() => state === "listening" ? stop() : start()}
        style={({ pressed }) => [styles.btn, {
          backgroundColor: state === "listening" ? colors.danger : colors.card,
          borderColor:     state === "listening" ? colors.danger : colors.border,
          opacity: pressed ? 0.9 : 1
        }]}>
        <Animated.Text style={[styles.mic, { transform: [{ scale: pulse }] }]}>
          {state === "listening" ? "⏺" : "🎤"}
        </Animated.Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: state === "listening" ? "#fff" : colors.text, ...font }]}>
            {state === "listening" ? (lang === "th-TH" ? "กำลังฟัง — แตะเพื่อหยุด" : "Listening — tap to stop")
             : state === "thinking" ? (lang === "th-TH" ? "กำลังประมวลผล…" : "Thinking…")
             : (lang === "th-TH" ? "แตะเพื่อพูด" : "Tap to speak")}
          </Text>
          {text ? (
            <Text style={[styles.transcript, { color: state === "listening" ? "#ffffffcc" : colors.textDim, ...font }]} numberOfLines={1}>
              "{text}"
            </Text>
          ) : (
            <Text style={[styles.hint, { color: colors.textMuted, ...font }]} numberOfLines={1}>
              {contextLabel ? `${contextLabel}  ·  ` : ""}{hint || ""}
            </Text>
          )}
        </View>
        <Pressable
          onPress={(e: any) => { e?.stopPropagation?.(); toggleLang(); }}
          hitSlop={8}
          style={[styles.langChip, {
            backgroundColor: state === "listening" ? "#ffffff22" : colors.bg,
            borderColor: state === "listening" ? "#ffffff44" : colors.border
          }]}>
          <Text style={[styles.langChipText, {
            color: state === "listening" ? "#fff" : colors.text, ...font
          }]}>{lang === "en-US" ? "EN" : "TH"}</Text>
        </Pressable>
      </Pressable>
      {toast ? (
        <View style={[styles.toast, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.toastText, { color: colors.text, ...font }]}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Convenience: caller can use this to show a one-off toast from outside (e.g. on success). */
export function makeVoiceToast() {
  // Not strictly needed yet — caller currently handles success toasts itself via showToast pattern.
}

const styles = StyleSheet.create({
  btn:       { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2 },
  mic:       { fontSize: 26 },
  label:     { fontSize: 14, fontWeight: "700" },
  transcript:{ fontSize: 13, fontStyle: "italic", marginTop: 2 },
  hint:      { fontSize: 11, marginTop: 2 },
  toast:     { marginTop: spacing.xs, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, alignItems: "center" },
  toastText: { fontSize: 13, fontWeight: "600" },
  langChip:  { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1, minWidth: 36, alignItems: "center" },
  langChipText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 }
});
