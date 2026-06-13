// Round home: shows the round info, list of players, and entry-points.
// Full live dashboard arrives in Sprint 4.
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Linking, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { useRound } from "@/lib/useRound";
import { api } from "@/lib/api";
import { trackRoundAccess } from "@/lib/device";
import type { Player } from "@/lib/types";

const PLAYER_PICK_KEY = (code: string) => `gv:${code}:player`;

export default function RoundIndex() {
  const { code: rawCode, admin } = useLocalSearchParams<{ code: string; admin?: string }>();
  const code = (rawCode || "").toUpperCase();
  const { colors } = useTheme();
  const { round, players, holes, scores, loading, error, refresh } = useRound(code);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  // Restore the player picked on this device for this round
  useEffect(() => { (async () => {
    const saved = await AsyncStorage.getItem(PLAYER_PICK_KEY(code));
    if (saved) setActivePlayerId(saved);
  })(); }, [code]);

  async function pickPlayer(p: Player) {
    setActivePlayerId(p.id);
    await AsyncStorage.setItem(PLAYER_PICK_KEY(code), p.id);
    if (round) await trackRoundAccess({ round_id: round.id, player_id: p.id });
  }

  if (loading) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.muted, { color: colors.textDim, ...font }]}>Loading round…</Text>
    </View>
  );
  if (error || !round) return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.muted, { color: colors.danger, ...font }]}>{error || "Round not found"}</Text>
      <Pressable onPress={refresh} style={[styles.btnPrimary, { backgroundColor: colors.accent }]}>
        <Text style={[styles.btnPrimaryText, { color: colors.accentText, ...font }]}>Try again</Text>
      </Pressable>
    </View>
  );

  const me = players.find(p => p.id === activePlayerId);
  const completeHoles = holes.length === 0 ? 0
    : holes.filter(h => scores.filter(s => s.hole_id === h.id && s.strokes != null).length === players.length).length;

  return (
    <FlatList
      data={players}
      keyExtractor={p => p.id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.lg }}>
          <View style={styles.codeRow}>
            <Text style={[styles.codeText, { color: colors.accent, ...font }]}>{code}</Text>
            {round.status === "active"
              ? <Text style={[styles.liveBadge, { color: colors.success, ...font }]}>● LIVE</Text>
              : <Text style={[styles.liveBadge, { color: colors.textMuted, ...font }]}>✓ FINISHED</Text>}
          </View>
          <Text style={[styles.title, { color: colors.text, ...font }]}>{round.name}</Text>
          {round.course_name && (
            <Text style={[styles.course, { color: colors.textDim, ...font }]}>📍 {round.course_name}</Text>
          )}
          <Text style={[styles.meta, { color: colors.textMuted, ...font }]}>
            {players.length} players · {holes.length} holes · {completeHoles}/{holes.length} complete · DF {round.dog_flight_stake} · Oly {round.olympic_stake} {round.currency}/pt
          </Text>

          {me && (
            <Pressable
              onPress={() => router.push({ pathname: "/round/[code]/score", params: { code, admin: admin || "" } })}
              style={[styles.bigCta, { backgroundColor: colors.accent }]}>
              <Text style={[styles.bigCtaText, { color: colors.accentText, ...font }]}>✏️  Enter scores for {me.name}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => Linking.openURL(`${api.base}/round/${code}${admin ? `?admin=${admin}` : ""}`)}
            style={[styles.btnGhost, { borderColor: colors.border }]}>
            <Text style={[styles.btnGhostText, { color: colors.textDim, ...font }]}>📊  Open live dashboard (web)</Text>
          </Pressable>

          <Text style={[styles.section, { color: colors.textDim, ...font }]}>
            {me ? "PLAYERS · TAP TO SWITCH" : "WHO ARE YOU? · PICK YOUR PLAYER"}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isMe = item.id === activePlayerId;
        const myScores = scores.filter(s => s.player_id === item.id && s.strokes != null).length;
        return (
          <Pressable
            onPress={() => pickPlayer(item)}
            style={({ pressed }) => [
              styles.playerCard,
              {
                backgroundColor: isMe ? `${item.color}22` : colors.card,
                borderColor: isMe ? item.color : colors.border,
                opacity: pressed ? 0.7 : 1
              }
            ]}>
            <View style={[styles.avatar, { backgroundColor: item.color }]}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{item.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.playerName, { color: colors.text, ...font }]}>{item.name}</Text>
              <Text style={[styles.playerMeta, { color: colors.textMuted, ...font }]}>
                Seat {item.seat} · {myScores}/{holes.length} holes entered{item.team ? ` · Team ${item.team}` : ""}
              </Text>
            </View>
            {isMe && <Text style={[styles.isMeBadge, { color: item.color, ...font }]}>YOU</Text>}
          </Pressable>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  muted: { fontSize: 14 },

  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeText: { fontSize: 18, fontWeight: "800", letterSpacing: 3, fontVariant: ["tabular-nums"] },
  liveBadge: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },

  title: { fontSize: 24, fontWeight: "700", marginTop: spacing.xs },
  course: { fontSize: 14, marginTop: 2 },
  meta:   { fontSize: 12, marginTop: spacing.xs },

  bigCta: { marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: "center" },
  bigCtaText: { fontSize: 16, fontWeight: "700" },

  btnPrimary: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radii.lg },
  btnPrimaryText: { fontSize: 16, fontWeight: "700" },

  btnGhost: { marginTop: spacing.sm, paddingVertical: spacing.md, borderRadius: radii.lg, borderWidth: 1, alignItems: "center" },
  btnGhostText: { fontSize: 14 },

  section: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginTop: spacing.xl, marginBottom: spacing.sm },

  playerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  playerName: { fontSize: 15, fontWeight: "600" },
  playerMeta: { fontSize: 12, marginTop: 2 },
  isMeBadge: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }
});
