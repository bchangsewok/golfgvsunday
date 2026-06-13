import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { api } from "@/lib/api";
import { trackRoundAccess } from "@/lib/device";
import type { RoundSummary } from "@/lib/types";

export default function AllRounds() {
  const { colors } = useTheme();
  const [rounds, setRounds]       = useState<RoundSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState<"all" | "active" | "finished">("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await api.listRounds(100);
      setRounds(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load rounds");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = rounds.filter(r => filter === "all" ? true : r.status === filter);

  async function open(r: RoundSummary) {
    // Register this device as a viewer for the round so it shows up under Recent
    await trackRoundAccess({ round_id: r.id });
    router.push({ pathname: "/round/[code]", params: { code: r.code } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {(["all", "active", "finished"] as const).map(k => {
          const active = filter === k;
          return (
            <Pressable key={k} onPress={() => setFilter(k)}
              style={[styles.filterPill, { backgroundColor: active ? colors.accent : colors.card, borderColor: active ? colors.accent : colors.border }]}>
              <Text style={[{ color: active ? colors.accentText : colors.text, fontWeight: "600", ...font }]}>
                {k === "all" ? "All" : k === "active" ? "● Live" : "✓ Finished"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && (
        <View style={{ padding: spacing.lg, alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {error && (
        <Text style={[styles.error, { color: colors.danger, ...font }]}>{error}</Text>
      )}

      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }
            ]}>
            <View style={styles.cardTop}>
              <Text style={[styles.code, { color: colors.accent, ...font }]}>{item.code}</Text>
              <Text style={[styles.status, { color: item.status === "active" ? colors.accent : colors.textDim, ...font }]}>
                {item.status === "active" ? "● live" : "✓ finished"}
              </Text>
            </View>
            <Text style={[styles.title, { color: colors.text, ...font }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.sub, { color: colors.textDim, ...font }]} numberOfLines={1}>
              {item.course_name || "—"}  ·  {item.player_count}p  ·  {item.hole_count}h
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted, ...font }]}>
              {new Date(item.created_at + "Z").toLocaleString()}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        ListEmptyComponent={!loading ? (
          <Text style={[{ color: colors.textDim, textAlign: "center", marginTop: spacing.xl, ...font }]}>
            No rounds yet.
          </Text>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1 },
  filterPill: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1 },
  card:    { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  code:    { fontSize: 14, fontWeight: "800", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  status:  { fontSize: 12, fontWeight: "600" },
  title:   { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  sub:     { fontSize: 13, marginBottom: 2 },
  meta:    { fontSize: 11 },
  error:   { textAlign: "center", padding: spacing.md, fontSize: 13 }
});
