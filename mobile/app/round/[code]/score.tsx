import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert, Animated, Easing
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { useRound } from "@/lib/useRound";
import { api } from "@/lib/api";
import { entryButtonsFor, termFor } from "@/lib/golfTerms";
import { createVoiceListener, type VoiceListener } from "@/lib/voice";
import { parseVoice } from "@/lib/voiceParser";
import type { Score } from "@/lib/types";

const PLAYER_PICK_KEY = (code: string) => `gv:${code}:player`;
const isNative = Platform.OS === "ios" || Platform.OS === "android";

export default function ScoreEntry() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = (rawCode || "").toUpperCase();
  const { colors } = useTheme();
  const { round, players, holes, scores, loading, error, refresh, setScore } = useRound(code);

  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [holeIdx, setHoleIdx] = useState(0);
  const [savingHint, setSavingHint] = useState<"" | "saving" | "saved">("");

  // Sorted holes (memoized so we can jump around safely)
  const sortedHoles = useMemo(() => [...holes].sort((a, b) => a.number - b.number), [holes]);
  const hole = sortedHoles[holeIdx];
  const me = players.find(p => p.id === activePlayerId);
  const myScore = useMemo(
    () => (me && hole ? scores.find(s => s.hole_id === hole.id && s.player_id === me.id) : undefined),
    [me, hole, scores]
  );

  // Restore picked player
  useEffect(() => { (async () => {
    const saved = await AsyncStorage.getItem(PLAYER_PICK_KEY(code));
    if (saved) setActivePlayerId(saved);
  })(); }, [code]);

  async function buzz(type: "select" | "ok" | "err" = "select") {
    if (!isNative) return;
    if      (type === "ok")  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === "err") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else                     await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function save(patch: Partial<Pick<Score, "strokes" | "olympic_points" | "olympic_special_points" | "sao_points">>) {
    if (!round || !hole || !me) return;
    setSavingHint("saving");
    try {
      const updated = await api.upsertScore({
        round_id: round.id, hole_id: hole.id, player_id: me.id,
        updated_by: "self",
        ...patch
      });
      setScore(updated);
      buzz("select");
      setSavingHint("saved");
      setTimeout(() => setSavingHint(""), 900);
    } catch (e: any) {
      setSavingHint("");
      buzz("err");
      Alert.alert("Couldn't save", e?.message || "Try again");
    }
  }

  function gotoHole(i: number) {
    const next = Math.max(0, Math.min(sortedHoles.length - 1, i));
    if (next !== holeIdx) {
      buzz("select");
      setHoleIdx(next);
    }
  }

  // ── Voice push-to-talk ─────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "thinking">("idle");
  const [voiceText,  setVoiceText]  = useState("");
  const [voiceToast, setVoiceToast] = useState("");
  const voiceRef = useRef<VoiceListener | null>(null);
  const voiceSupportedRef = useRef<boolean | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Probe support once
  if (voiceSupportedRef.current === null) {
    const probe = createVoiceListener({ onFinal: () => {} });
    voiceSupportedRef.current = probe.isSupported;
  }
  const voiceSupported = voiceSupportedRef.current;

  // Pulse animation while listening
  useEffect(() => {
    if (voiceState !== "listening") { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [voiceState, pulse]);

  function showToast(msg: string) {
    setVoiceToast(msg);
    setTimeout(() => setVoiceToast(""), 1800);
  }

  function applyParse(text: string) {
    if (!hole || !round || !me) return;
    const parsed = parseVoice(text, hole.par);
    if (!parsed) {
      buzz("err");
      showToast(`🤷  Couldn't understand "${text}"`);
      return;
    }
    if (parsed.command === "next") { gotoHole(holeIdx + 1); showToast("⏭  Next hole"); return; }
    if (parsed.command === "back") { gotoHole(holeIdx - 1); showToast("⏮  Previous hole"); return; }

    const patch: Partial<Pick<Score, "strokes" | "olympic_points" | "olympic_special_points" | "sao_points">> = {};
    if (parsed.strokes != null)                patch.strokes = parsed.strokes;
    if (parsed.olympic_points != null)         patch.olympic_points = parsed.olympic_points;
    if (parsed.olympic_special_points != null) patch.olympic_special_points = parsed.olympic_special_points;
    if (parsed.sao_points != null)             patch.sao_points = parsed.sao_points;
    if (Object.keys(patch).length === 0) {
      buzz("err");
      showToast(`🤷  "${text}"`);
      return;
    }
    save(patch);
    buzz("ok");
    showToast(`✓  ${parsed.summary}`);
  }

  function handleVoiceError(code: string) {
    buzz("err");
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

  function startVoice() {
    if (!voiceSupported || voiceState === "listening") return;
    buzz("select");
    setVoiceText("");
    setVoiceState("listening");
    voiceRef.current = createVoiceListener({
      onPartial: setVoiceText,
      onFinal:   (text) => { setVoiceState("thinking"); applyParse(text); },
      onError:   handleVoiceError,
      // Always reset UI here so a stuck "Listening…" can't happen,
      // regardless of which terminal callback fired.
      onEnd:     ()     => { setVoiceState("idle"); setVoiceText(""); }
    });
    voiceRef.current.start();
  }
  function stopVoice() {
    voiceRef.current?.stop();
  }

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textDim, ...font }}>Loading…</Text>
    </View>
  );
  if (error || !round) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.danger, ...font }}>{error || "Not found"}</Text>
    </View>
  );

  // Force seat-pick if missing
  if (!me) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.text, ...font, fontSize: 16, marginBottom: spacing.md, textAlign: "center" }}>
        Pick yourself first on the round page.
      </Text>
      <Pressable onPress={() => router.back()} style={[styles.btnPrimary, { backgroundColor: colors.accent }]}>
        <Text style={[styles.btnPrimaryText, { color: colors.accentText, ...font }]}>Go back</Text>
      </Pressable>
    </View>
  );

  if (!hole) return null;
  const olyMax = round.player_count;
  const strokeButtons = entryButtonsFor(hole.par, 9);
  const currentTerm = myScore?.strokes != null ? termFor(myScore.strokes, hole.par) : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>

      {/* Active player chip */}
      <View style={[styles.playerChip, { backgroundColor: `${me.color}22`, borderColor: me.color }]}>
        <View style={[styles.avatar, { backgroundColor: me.color }]}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{me.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.playerChipText, { color: colors.text, ...font }]}>Entering for <Text style={{ fontWeight: "800" }}>{me.name}</Text></Text>
        <Pressable onPress={() => router.back()} style={styles.switchBtn}>
          <Text style={{ color: colors.accent, fontWeight: "700", ...font }}>Switch</Text>
        </Pressable>
      </View>

      {/* Voice — tap to start, tap again to stop (works reliably on iOS) */}
      {voiceSupported && (
        <View style={{ marginBottom: spacing.md }}>
          <Pressable
            onPress={() => voiceState === "listening" ? stopVoice() : startVoice()}
            style={({ pressed }) => [styles.voiceBtn, {
              backgroundColor: voiceState === "listening" ? colors.danger : colors.card,
              borderColor:     voiceState === "listening" ? colors.danger : colors.border,
              opacity: pressed ? 0.9 : 1
            }]}>
            <Animated.Text style={[styles.voiceMic, { transform: [{ scale: pulse }] }]}>
              {voiceState === "listening" ? "⏺" : "🎤"}
            </Animated.Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.voiceLabel, {
                color: voiceState === "listening" ? "#fff" : colors.text, ...font
              }]}>
                {voiceState === "listening" ? "Listening — tap to stop"
                 : voiceState === "thinking" ? "Thinking…"
                 : "Tap to speak"}
              </Text>
              {voiceText ? (
                <Text style={[styles.voiceTranscript, {
                  color: voiceState === "listening" ? "#ffffffcc" : colors.textDim, ...font
                }]} numberOfLines={1}>
                  "{voiceText}"
                </Text>
              ) : (
                <Text style={[styles.voiceHint, { color: colors.textMuted, ...font }]} numberOfLines={1}>
                  e.g. "4133" = str·oly·spec·sao  ·  "birdie"  ·  "next"
                </Text>
              )}
            </View>
          </Pressable>
          {voiceToast ? (
            <View style={[styles.voiceToast, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.voiceToastText, { color: colors.text, ...font }]}>{voiceToast}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Hole header + prev/next */}
      <View style={[styles.holeHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={() => gotoHole(holeIdx - 1)} disabled={holeIdx === 0}
                   style={[styles.navBtn, { opacity: holeIdx === 0 ? 0.3 : 1 }]}>
          <Text style={{ color: colors.text, fontSize: 24, ...font }}>‹</Text>
        </Pressable>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.holeBig, { color: colors.text, ...font }]}>Hole {hole.number}</Text>
          <Text style={[styles.holeMeta, { color: colors.textDim, ...font }]}>
            Par {hole.par}{hole.multiplier > 1 ? `   ·   ×${hole.multiplier}` : ""}
          </Text>
        </View>
        <Pressable onPress={() => gotoHole(holeIdx + 1)} disabled={holeIdx === sortedHoles.length - 1}
                   style={[styles.navBtn, { opacity: holeIdx === sortedHoles.length - 1 ? 0.3 : 1 }]}>
          <Text style={{ color: colors.text, fontSize: 24, ...font }}>›</Text>
        </Pressable>
      </View>

      {/* Hole progress dots */}
      <View style={styles.dotsRow}>
        {sortedHoles.map((h, i) => {
          const filled = scores.some(s => s.hole_id === h.id && s.player_id === me.id && s.strokes != null);
          const active = i === holeIdx;
          return (
            <Pressable key={h.id} onPress={() => gotoHole(i)} style={styles.dotBtn}>
              <View style={[styles.dot, {
                backgroundColor: active ? colors.accent : filled ? `${colors.accent}80` : colors.border,
                transform: [{ scale: active ? 1.4 : 1 }]
              }]} />
            </Pressable>
          );
        })}
      </View>

      {/* Current term chip */}
      {currentTerm && (
        <View style={styles.termChipWrap}>
          <Text style={[styles.termChip, { color: colors.accent, backgroundColor: `${colors.accent}22`, ...font }]}>
            {currentTerm.label} · {myScore!.strokes} strokes
          </Text>
        </View>
      )}

      {/* Strokes grid */}
      <Text style={[styles.label, { color: colors.textDim, ...font }]}>STROKES</Text>
      <View style={styles.strokeGrid}>
        {strokeButtons.map(b => {
          const selected = myScore?.strokes === b.strokes;
          const d = b.strokes - hole.par;
          const tint =
            d <= -1 ? colors.birdie :  // red — birdie or better
            d >= 1  ? colors.bogey  :  // dark blue — bogey or worse
            colors.par;                // par — neutral
          return (
            <Pressable
              key={b.strokes}
              onPress={() => save({ strokes: b.strokes })}
              style={({ pressed }) => [styles.strokeBtn, {
                backgroundColor: selected ? tint : colors.card,
                borderColor:     selected ? tint : colors.border,
                transform: [{ scale: pressed ? 0.96 : 1 }]
              }]}>
              <Text style={[styles.strokeNum, { color: selected ? "#fff" : colors.text, ...font }]}>{b.strokes}</Text>
              <Text style={[styles.strokeLabel, { color: selected ? "#ffffffcc" : colors.textMuted, ...font }]}>{b.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Olympic */}
      <Text style={[styles.label, { color: colors.textDim, ...font, marginTop: spacing.lg }]}>🏆 OLYMPIC · 0 – {olyMax}</Text>
      <View style={styles.olyRow}>
        {Array.from({ length: olyMax + 1 }, (_, n) => n).map(n => {
          const selected = (myScore?.olympic_points ?? 0) === n;
          return (
            <Pressable key={n} onPress={() => save({ olympic_points: n })}
              style={({ pressed }) => [styles.olyBtn, {
                backgroundColor: selected ? colors.warning : colors.card,
                borderColor:     selected ? colors.warning : colors.border,
                transform: [{ scale: pressed ? 0.92 : 1 }]
              }]}>
              <Text style={[styles.olyNum, { color: selected ? "#fff" : colors.text, ...font }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Olympic Special */}
      <Text style={[styles.label, { color: colors.textDim, ...font, marginTop: spacing.lg }]}>✨ OLYMPIC SPECIAL · -3 to +15</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: 4 }}>
        {Array.from({ length: 19 }, (_, i) => i - 3).map(n => {
          const selected = (myScore?.olympic_special_points ?? 0) === n;
          const tone = n === 0 ? colors.textMuted : n > 0 ? colors.warning : colors.danger;
          return (
            <Pressable key={n} onPress={() => save({ olympic_special_points: n })}
              style={({ pressed }) => [styles.spBtn, {
                backgroundColor: selected ? tone : colors.card,
                borderColor:     selected ? tone : colors.border,
                transform: [{ scale: pressed ? 0.92 : 1 }]
              }]}>
              <Text style={[styles.spNum, { color: selected ? "#fff" : tone, ...font }]}>
                {n > 0 ? `+${n}` : n}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* SAO */}
      <Text style={[styles.label, { color: colors.textDim, ...font, marginTop: spacing.lg }]}>⚡ SAO</Text>
      <View style={styles.saoRow}>
        {[-3, 0, 3].map(n => {
          const selected = (myScore?.sao_points ?? 0) === n;
          const tone = n === 0 ? colors.textMuted : n > 0 ? "#a855f7" : colors.danger;
          return (
            <Pressable key={n} onPress={() => save({ sao_points: n })}
              style={({ pressed }) => [styles.saoBtn, {
                backgroundColor: selected ? tone : colors.card,
                borderColor:     selected ? tone : colors.border,
                transform: [{ scale: pressed ? 0.95 : 1 }]
              }]}>
              <Text style={[styles.saoLabel, { color: selected ? "#fff" : tone, ...font }]}>
                {n > 0 ? `+${n}` : n === 0 ? "—" : n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: spacing.xl, alignItems: "center", justifyContent: "center" }}>
        {savingHint === "saving" && <Text style={{ color: colors.textMuted, ...font }}>Saving…</Text>}
        {savingHint === "saved"  && <Text style={{ color: colors.success, fontWeight: "700", ...font }}>✓ Saved</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },

  playerChip: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2, marginBottom: spacing.md },
  avatar:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  playerChipText: { fontSize: 14, flex: 1 },
  switchBtn:  { paddingHorizontal: spacing.sm, paddingVertical: 4 },

  holeHeader: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.sm },
  navBtn:    { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  holeBig:   { fontSize: 32, fontWeight: "800" },
  holeMeta:  { fontSize: 13 },

  dotsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: spacing.md, justifyContent: "center" },
  dotBtn:  { padding: 4 },
  dot:     { width: 8, height: 8, borderRadius: 4 },

  termChipWrap: { alignItems: "center", marginBottom: spacing.md },
  termChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, fontWeight: "700", fontSize: 13, overflow: "hidden" },

  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: spacing.sm },

  strokeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  strokeBtn:  { width: "31.5%", aspectRatio: 1.4, borderWidth: 2, borderRadius: radii.lg, alignItems: "center", justifyContent: "center" },
  strokeNum:  { fontSize: 26, fontWeight: "800" },
  strokeLabel:{ fontSize: 11, marginTop: 2 },

  olyRow: { flexDirection: "row", gap: spacing.xs },
  olyBtn: { flex: 1, height: 48, borderWidth: 2, borderRadius: radii.lg, alignItems: "center", justifyContent: "center" },
  olyNum: { fontSize: 18, fontWeight: "800" },

  spBtn: { minWidth: 54, height: 48, borderWidth: 2, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  spNum: { fontSize: 14, fontWeight: "800" },

  saoRow: { flexDirection: "row", gap: spacing.xs },
  saoBtn: { flex: 1, height: 56, borderWidth: 2, borderRadius: radii.lg, alignItems: "center", justifyContent: "center" },
  saoLabel: { fontSize: 18, fontWeight: "800" },

  btnPrimary: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radii.lg },
  btnPrimaryText: { fontSize: 16, fontWeight: "700" },

  voiceBtn:        { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 2 },
  voiceMic:        { fontSize: 26 },
  voiceLabel:      { fontSize: 14, fontWeight: "700" },
  voiceTranscript: { fontSize: 13, fontStyle: "italic", marginTop: 2 },
  voiceHint:       { fontSize: 11, marginTop: 2 },
  voiceToast:      { marginTop: spacing.xs, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, alignItems: "center" },
  voiceToastText:  { fontSize: 13, fontWeight: "600" }
});
