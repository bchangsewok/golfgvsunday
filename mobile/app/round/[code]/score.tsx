import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { useRound } from "@/lib/useRound";
import { api } from "@/lib/api";
import { entryButtonsFor, termFor } from "@/lib/golfTerms";
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
  btnPrimaryText: { fontSize: 16, fontWeight: "700" }
});
