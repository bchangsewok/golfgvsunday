// Placeholder for Sprint 4 (live dashboard).
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme, spacing, font } from "@/lib/theme";

export default function RoundDashboard() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Pressable onPress={() => router.back()} style={{ position: "absolute", top: 48, left: 16 }}>
        <Text style={{ color: colors.accent, fontSize: 16, ...font }}>← Back</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text, ...font }]}>Round {code}</Text>
      <Text style={[styles.sub, { color: colors.textDim, ...font }]}>Live dashboard + Score Entry · coming in Sprints 3 & 4</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { fontSize: 24, fontWeight: "700", marginBottom: spacing.sm },
  sub: { fontSize: 14, textAlign: "center" }
});
