// Placeholder for Sprint 2 (QR + code input).
import { View, Text, StyleSheet } from "react-native";
import { useTheme, spacing, font } from "@/lib/theme";

export default function Join() {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text, ...font }]}>Join a round</Text>
      <Text style={[styles.sub, { color: colors.textDim, ...font }]}>QR scanner + code entry · coming in Sprint 2</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { fontSize: 24, fontWeight: "700", marginBottom: spacing.sm },
  sub: { fontSize: 14, textAlign: "center" }
});
