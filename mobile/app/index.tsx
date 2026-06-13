import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Platform, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { fetchDeviceRounds, getDeviceLabel, forgetRound } from "@/lib/device";
import type { DeviceRound } from "@/lib/types";

export default function Home() {
  const { colors } = useTheme();
  const [rounds, setRounds] = useState<DeviceRound[]>([]);
  const [label, setLabel] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    setLabel(await getDeviceLabel());
    setRounds(await fetchDeviceRounds());
    setRefreshing(false);
  }
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={rounds}
        keyExtractor={r => r.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.greeting, { color: colors.text, ...font }]}>
              {label ? `Hi, ${label}` : "Welcome to GolfGV"}
            </Text>
            <Text style={[styles.sub, { color: colors.textDim, ...font }]}>
              {rounds.length === 0 ? "Scan a QR or enter a code to join a round." : `${rounds.length} round${rounds.length === 1 ? "" : "s"} on this phone.`}
            </Text>
            <View style={styles.ctaRow}>
              <Pressable
                style={[styles.cta, { backgroundColor: colors.accent }]}
                onPress={() => router.push("/new-round")}>
                <Text style={[styles.ctaText, { color: colors.accentText, ...font }]}>＋  New round</Text>
              </Pressable>
              <Pressable
                style={[styles.cta, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => router.push("/join")}>
                <Text style={[styles.ctaText, { color: colors.text, ...font }]}>📷  Join</Text>
              </Pressable>
            </View>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: colors.textDim, ...font }]}>
                {rounds.length > 0 ? "ON THIS PHONE" : ""}
              </Text>
              <Pressable onPress={() => router.push("/all-rounds")}>
                <Text style={[styles.linkBtn, { color: colors.accent, ...font }]}>👑 My rounds ›</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => <RoundCard round={item} onChanged={load} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        ListEmptyComponent={null}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/settings")}>
        <Text style={[styles.fabText, { color: colors.text, ...font }]}>⚙️</Text>
      </Pressable>
    </View>
  );
}

function RoundCard({ round: r, onChanged }: { round: DeviceRound; onChanged: () => void }) {
  const { colors } = useTheme();
  const isAdmin = r.is_admin === 1 && r.admin_token;
  const roleLabel = isAdmin ? "👑 Admin" : r.player_id && r.player_name ? `🟢 ${r.player_name}` : "👁 Viewer";

  function open() {
    router.push({ pathname: "/round/[code]", params: { code: r.code, admin: isAdmin ? r.admin_token! : "" } });
  }
  function onLongPress() {
    Alert.alert(r.name, undefined, [
      { text: "Forget this round", style: "destructive", onPress: async () => { await forgetRound(r.round_id); onChanged(); } },
      { text: "Cancel", style: "cancel" }
    ]);
  }

  return (
    <Pressable onPress={open} onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }
      ]}>
      <View style={styles.cardTop}>
        <Text style={[styles.code, { color: colors.accent, ...font }]}>{r.code}</Text>
        <Text style={[styles.role, { color: colors.textDim, ...font }]}>{roleLabel}</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.text, ...font }]} numberOfLines={1}>{r.name}</Text>
      <Text style={[styles.cardSub, { color: colors.textDim, ...font }]} numberOfLines={1}>
        {r.course_name || "—"}  ·  {r.status === "active" ? "● live" : "✓ finished"}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.textMuted, ...font }]}>
        last seen {new Date(r.last_seen + "Z").toLocaleString()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: spacing.lg },
  greeting: { fontSize: 28, fontWeight: "700", marginBottom: spacing.xs },
  sub: { fontSize: 14, marginBottom: spacing.lg },
  ctaRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  cta: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: "center", ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) },
  ctaText: { fontSize: 16, fontWeight: "700" },
  sectionHead:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  linkBtn:      { fontSize: 13, fontWeight: "600" },
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  code: { fontSize: 14, fontWeight: "800", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  role: { fontSize: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  cardSub: { fontSize: 13, marginBottom: 2 },
  cardMeta: { fontSize: 11 },
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg + 8,
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 4 } })
  },
  fabText: { fontSize: 22 }
});
